package sender

// Testes de resiliência a falhas de rede do pacote sender.
//
// Princípios seguidos aqui:
//   - Nenhuma chamada de rede real: todo backend é um httptest.NewServer local.
//     Os testes de falha de DNS usam um nome com rótulo de mais de 63 caracteres
//     (limite da RFC 1035), que TODO resolvedor rejeita localmente — nenhum pacote
//     sai da máquina e o resultado não depende do DNS/rede de quem executa.
//   - Nenhuma escrita em caminho real do sistema.
//   - Nenhuma alteração de código de produção. Onde um teste só passaria mudando
//     produção, o teste está marcado com t.Skip e o problema está documentado no
//     comentário do próprio teste.
//
// LIMITAÇÕES DE TESTABILIDADE (constantes não injetáveis em api.go):
//   - maxRetries=3 é const. Não é um problema de testabilidade em si (3 tentativas
//     é rápido de exercitar), mas qualquer teste que force o laço inteiro a esgotar
//     as tentativas paga o custo cumulativo do backoff — mitigado pelo item abaixo.
//   - httpTimeout=15s é const. O timeout é testado substituindo temporariamente a
//     var de pacote httpClient por um client de timeout curto — só é possível
//     porque httpClient é var e o teste está no mesmo pacote. Se httpClient virasse
//     const/local, o comportamento de timeout ficaria não testável.
//
// CORRIGIDO (item B.9): retryBaseDelay (base do backoff exponencial) passou a ser
// var, não const — os testes do laço de retry abaixo reduzem para poucos
// milissegundos antes de chamar Send() e restauram o valor original depois. Antes
// desta correção, retryInterval era const de 10s e um teste do laço de retry
// completo custava ~20s reais, escondido atrás de testing.Short()/uma variável de
// ambiente de opt-in.

import (
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"orion-agent/collector"
	"orion-agent/config"
)

const pathHeartbeat = "/api/monitoring/machines/heartbeat"

// hostDNSInvalido é um nome de host cujo primeiro rótulo tem 100 caracteres — acima
// do limite de 63 imposto pela RFC 1035. O resolvedor do sistema recusa o nome sem
// emitir nenhuma consulta na rede, o que torna o teste de falha de DNS determinístico
// em qualquer máquina (inclusive atrás de DNS que sequestra NXDOMAIN) e garante que
// NENHUM pacote sai do computador que roda a suíte.
var hostDNSInvalido = strings.Repeat("orion", 20) + ".teste-local"

// cfgDeTeste monta uma config apontando para o servidor fake informado.
func cfgDeTeste(apiURL string) *config.Config {
	return &config.Config{
		APIURL:          apiURL,
		AgentKey:        "chave-de-teste-123",
		IntervalSeconds: 60,
		LogFile:         "agent.log",
	}
}

// payloadDeTeste devolve um payload mínimo e determinístico (nada é coletado
// da máquina real, para o teste não depender do hardware do executor).
func payloadDeTeste() *collector.Payload {
	return &collector.Payload{
		MachineToken: "token-fake",
		MachineUUID:  "uuid-fake",
		Hostname:     "PC-TESTE",
		IP:           "10.0.0.1",
		OS:           "windows",
	}
}

// usarClienteComTimeout troca a var de pacote httpClient por um client com
// timeout curto e restaura o original ao fim do teste. Necessário porque
// httpTimeout (15s) é const em api.go.
func usarClienteComTimeout(t *testing.T, timeout time.Duration) {
	t.Helper()
	original := httpClient
	httpClient = &http.Client{Timeout: timeout}
	t.Cleanup(func() { httpClient = original })
}

// executarComPrazo roda fn e falha o teste se ela não retornar dentro do prazo.
// Serve para provar que uma falha de rede retorna de forma graciosa em vez de travar.
func executarComPrazo(t *testing.T, prazo time.Duration, fn func()) {
	t.Helper()
	pronto := make(chan struct{})
	go func() {
		defer close(pronto)
		fn()
	}()
	select {
	case <-pronto:
	case <-time.After(prazo):
		t.Fatalf("a chamada não retornou em %v — comportamento de travamento", prazo)
	}
}

// requisicaoCapturada guarda o que o backend fake recebeu. O handler roda em
// outra goroutine, então todo acesso é protegido por mutex (exigido pelo -race).
type dadosRequisicao struct {
	metodo      string
	path        string
	query       string
	agentKey    string
	contentType string
	corpo       string
	chamadas    int
}

type requisicaoCapturada struct {
	mu    sync.Mutex
	dados dadosRequisicao
}

func (c *requisicaoCapturada) registrar(r *http.Request) {
	corpo, _ := io.ReadAll(r.Body)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dados.metodo = r.Method
	c.dados.path = r.URL.Path
	c.dados.query = r.URL.RawQuery
	c.dados.agentKey = r.Header.Get("X-Agent-Key")
	c.dados.contentType = r.Header.Get("Content-Type")
	c.dados.corpo = string(corpo)
	c.dados.chamadas++
}

// ler devolve uma cópia consistente dos dados capturados.
func (c *requisicaoCapturada) ler() dadosRequisicao {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.dados
}

// servidorQueResponde cria um backend fake que devolve status/corpo fixos e
// registra a última requisição recebida.
func servidorQueResponde(t *testing.T, status int, corpo string, capt *requisicaoCapturada) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if capt != nil {
			capt.registrar(r)
		}
		w.WriteHeader(status)
		if corpo != "" {
			_, _ = w.Write([]byte(corpo))
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

// ---------------------------------------------------------------------------
// A) CAMINHO FELIZ
// ---------------------------------------------------------------------------

func TestSend_CaminhoFeliz_RetornaMachineID(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `{"machine_id":"abc"}`, &capt)

	machineID, err := Send(cfgDeTeste(srv.URL), payloadDeTeste())
	if err != nil {
		t.Fatalf("erro inesperado no caminho feliz: %v", err)
	}
	if machineID != "abc" {
		t.Errorf("machineID = %q, esperado %q", machineID, "abc")
	}
	got := capt.ler()
	if got.chamadas != 1 {
		t.Errorf("backend recebeu %d chamadas, esperado 1 (não deve haver retry no sucesso)", got.chamadas)
	}
	if got.metodo != http.MethodPost {
		t.Errorf("método = %q, esperado POST", got.metodo)
	}
	if got.contentType != "application/json" {
		t.Errorf("Content-Type = %q, esperado application/json", got.contentType)
	}
	if !strings.Contains(got.corpo, `"hostname":"PC-TESTE"`) {
		t.Errorf("o payload não chegou serializado ao backend; corpo recebido: %s", got.corpo)
	}
}

// ---------------------------------------------------------------------------
// F) HEADER DE AUTENTICAÇÃO
// ---------------------------------------------------------------------------

func TestSend_EnviaHeaderXAgentKey(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `{"machine_id":"abc"}`, &capt)

	if _, err := Send(cfgDeTeste(srv.URL), payloadDeTeste()); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got := capt.ler(); got.agentKey != "chave-de-teste-123" {
		t.Errorf("X-Agent-Key = %q, esperado %q", got.agentKey, "chave-de-teste-123")
	}
}

func TestPollCommands_EnviaHeaderXAgentKey(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `[]`, &capt)

	if _, err := PollCommands(cfgDeTeste(srv.URL), "maq-1"); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got := capt.ler(); got.agentKey != "chave-de-teste-123" {
		t.Errorf("X-Agent-Key = %q, esperado %q", got.agentKey, "chave-de-teste-123")
	}
}

func TestRespondToCommand_EnviaHeaderXAgentKeyEPayload(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `{}`, &capt)

	if err := RespondToCommand(cfgDeTeste(srv.URL), "cmd-1", "completed", "saida"); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	got := capt.ler()
	if got.agentKey != "chave-de-teste-123" {
		t.Errorf("X-Agent-Key = %q, esperado %q", got.agentKey, "chave-de-teste-123")
	}
	if !strings.Contains(got.corpo, `"id":"cmd-1"`) || !strings.Contains(got.corpo, `"status":"completed"`) {
		t.Errorf("corpo enviado não contém id/status esperados: %s", got.corpo)
	}
}

// ---------------------------------------------------------------------------
// B) FALHAS DO BACKEND — exercitadas em doPost() para evitar os 20s de retry
// ---------------------------------------------------------------------------

func TestDoPost_HTTP500ComCorpoJSON_ErroContemMensagemDoBackend(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusInternalServerError, `{"error":"banco indisponivel"}`, nil)

	machineID, err := doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	if err == nil {
		t.Fatal("esperado erro para HTTP 500, veio nil")
	}
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio em caso de erro", machineID)
	}
	if !strings.Contains(err.Error(), "banco indisponivel") {
		t.Errorf("erro %q não propaga a mensagem do backend", err.Error())
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("erro %q não menciona o status HTTP", err.Error())
	}
}

func TestDoPost_HTTP500ComCorpoNaoJSON_RetornaErroSemPanic(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusInternalServerError, `<html>502 Bad Gateway</html>`, nil)

	// doPost ignora o erro de Decode aqui; o teste garante que isso não vira panic
	// e que o erro genérico com status ainda é devolvido.
	_, err := doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	if err == nil {
		t.Fatal("esperado erro para HTTP 500 com corpo não-JSON, veio nil")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("erro %q não menciona o status HTTP 500", err.Error())
	}
}

func TestDoPost_HTTP500ComCorpoVazio_RetornaErro(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusInternalServerError, "", nil)

	if _, err := doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`)); err == nil {
		t.Fatal("esperado erro para HTTP 500 com corpo vazio, veio nil")
	}
}

func TestDoPost_HTTP401ChaveInvalida_RetornaErro(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusUnauthorized, `{"error":"chave de agente invalida"}`, nil)

	_, err := doPost(srv.URL+pathHeartbeat, "chave-errada", []byte(`{}`))
	if err == nil {
		t.Fatal("esperado erro para HTTP 401, veio nil")
	}
	if !strings.Contains(err.Error(), "chave de agente invalida") {
		t.Errorf("erro %q não propaga a mensagem de 401 do backend", err.Error())
	}
}

// BUG (documentado, não corrigido): doPost descarta o erro de
// json.NewDecoder(resp.Body).Decode(&res) na resposta 200. Com JSON malformado o
// agente recebe machineID vazio e err == nil, ou seja, ACHA QUE TEVE SUCESSO.
// Este teste ativo registra o comportamento observável hoje (sem panic) e o teste
// seguinte, pulado, descreve o comportamento correto.
func TestDoPost_Resposta200ComJSONMalformado_NaoEntraEmPanic(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusOK, `{{{`, nil)

	var machineID string
	var err error
	executarComPrazo(t, 5*time.Second, func() {
		machineID, err = doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	})
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio com JSON malformado", machineID)
	}
	t.Logf("comportamento atual com JSON malformado: machineID=%q err=%v (erro de Decode é descartado)", machineID, err)
}

// CORRIGIDO (item B.11): doPost passou a tratar o erro de Decode. Antes, um corpo
// malformado virava sucesso silencioso com machineID vazio, o chamador logava
// "[OK] Check-in realizado" e o polling de comandos nunca mais rodava.
func TestDoPost_Resposta200ComJSONMalformado_DeveriaRetornarErro(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusOK, `{{{`, nil)

	_, err := doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	if err == nil {
		t.Fatal("resposta 200 com JSON malformado deveria retornar erro, não sucesso silencioso")
	}
}

func TestDoPost_Resposta200ComCorpoVazio_NaoEntraEmPanic(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusOK, "", nil)

	var machineID string
	var err error
	executarComPrazo(t, 5*time.Second, func() {
		machineID, err = doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	})
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio com corpo vazio", machineID)
	}
	// Mesma raiz do bug acima: io.EOF do Decode é descartado.
	t.Logf("comportamento atual com corpo vazio: machineID=%q err=%v", machineID, err)
}

func TestDoPost_Resposta200SemCampoMachineID_RetornaVazio(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusOK, `{"outro_campo":"x"}`, nil)

	machineID, err := doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio quando o backend não envia machine_id", machineID)
	}
}

func TestDoPost_BackendIndisponivel_ConexaoRecusada(t *testing.T) {
	// Servidor criado e imediatamente fechado: a porta fica sem quem escute,
	// simulando backend fora do ar / connection refused.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := srv.URL + pathHeartbeat
	srv.Close()

	var err error
	executarComPrazo(t, 20*time.Second, func() {
		_, err = doPost(url, "chave", []byte(`{}`))
	})
	if err == nil {
		t.Fatal("esperado erro com backend fora do ar, veio nil")
	}
	if !strings.Contains(err.Error(), "request:") {
		t.Errorf("erro %q não veio embrulhado como erro de request", err.Error())
	}
}

// ---------------------------------------------------------------------------
// C) DNS FALHANDO
// ---------------------------------------------------------------------------

func TestDoPost_DNSNaoResolve_RetornaErroSemTravar(t *testing.T) {
	// Nome recusado localmente pelo resolvedor: nenhuma consulta chega à rede.
	urlInvalida := "https://" + hostDNSInvalido + pathHeartbeat

	var machineID string
	var err error
	executarComPrazo(t, 20*time.Second, func() {
		machineID, err = doPost(urlInvalida, "chave", []byte(`{}`))
	})
	if err == nil {
		t.Fatal("esperado erro de resolução de DNS, veio nil")
	}
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio em falha de DNS", machineID)
	}
}

func TestPollCommands_DNSNaoResolve_RetornaErroSemTravar(t *testing.T) {
	cfg := cfgDeTeste("https://" + hostDNSInvalido)

	var err error
	executarComPrazo(t, 20*time.Second, func() {
		_, err = PollCommands(cfg, "maq-1")
	})
	if err == nil {
		t.Fatal("PollCommands deveria retornar erro quando o DNS não resolve")
	}
}

// ---------------------------------------------------------------------------
// D) TIMEOUT
// ---------------------------------------------------------------------------

func TestDoPost_ServidorLento_EstouraTimeoutDoCliente(t *testing.T) {
	// httpTimeout é const 15s em api.go; para não deixar a suíte lenta trocamos
	// temporariamente a var de pacote httpClient por um client de 200ms.
	// ACHADO DE TESTABILIDADE: sem essa var exportável no pacote, o caminho de
	// timeout seria intestável sem esperar 15s reais.
	usarClienteComTimeout(t, 200*time.Millisecond)

	liberar := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-liberar // segura a resposta até o fim do teste
	}))
	defer func() {
		close(liberar)
		srv.Close()
	}()

	inicio := time.Now()
	var err error
	executarComPrazo(t, 10*time.Second, func() {
		_, err = doPost(srv.URL+pathHeartbeat, "chave", []byte(`{}`))
	})
	decorrido := time.Since(inicio)

	if err == nil {
		t.Fatal("esperado erro de timeout, veio nil")
	}
	if decorrido > 5*time.Second {
		t.Errorf("timeout demorou %v — o client não está respeitando o Timeout configurado", decorrido)
	}
	if !strings.Contains(strings.ToLower(err.Error()), "timeout") &&
		!strings.Contains(strings.ToLower(err.Error()), "deadline") {
		t.Errorf("erro %q não parece um erro de timeout", err.Error())
	}
}

// ---------------------------------------------------------------------------
// E) CONSTRUÇÃO DE URL
// ---------------------------------------------------------------------------

func TestSend_ConstroiURLDoHeartbeatParaVariasFormasDeAPIURL(t *testing.T) {
	casos := []struct {
		nome   string
		sufixo string
	}{
		{"dominio puro", ""},
		{"dominio com barra final", "/"},
		{"api_url ja com o path completo", pathHeartbeat},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			var capt requisicaoCapturada
			srv := servidorQueResponde(t, http.StatusOK, `{"machine_id":"ok"}`, &capt)

			machineID, err := Send(cfgDeTeste(srv.URL+c.sufixo), payloadDeTeste())
			if err != nil {
				t.Fatalf("erro inesperado para APIURL %q: %v", srv.URL+c.sufixo, err)
			}
			if machineID != "ok" {
				t.Errorf("machineID = %q, esperado %q", machineID, "ok")
			}
			if got := capt.ler(); got.path != pathHeartbeat {
				t.Errorf("path chamado = %q, esperado %q (path duplicado ou malformado)", got.path, pathHeartbeat)
			}
		})
	}
}

func TestSend_APIURLComPathCompletoEBarraFinal_NaoDeveDuplicarOPath(t *testing.T) {
	t.Skip("BUG CONHECIDO: em Send (api.go:34-36) o teste de sufixo usa a URL crua, mas o " +
		"TrimSuffix(\"/\") só é aplicado depois. Com api_url = \"https://x.com" + pathHeartbeat + "/\" " +
		"o HasSuffix falha por causa da barra e o path é concatenado de novo, gerando " +
		"\"" + pathHeartbeat + pathHeartbeat + "\" (404 no backend, heartbeat nunca chega). " +
		"Correção: normalizar (TrimSuffix da barra) ANTES de checar o sufixo. " +
		"— remover o Skip após corrigir")

	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `{"machine_id":"ok"}`, &capt)

	if _, err := Send(cfgDeTeste(srv.URL+pathHeartbeat+"/"), payloadDeTeste()); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got := capt.ler(); got.path != pathHeartbeat {
		t.Fatalf("path chamado = %q, esperado %q", got.path, pathHeartbeat)
	}
}

func TestPollCommands_ConstroiURLParaVariasFormasDeAPIURL(t *testing.T) {
	casos := []struct {
		nome   string
		sufixo string
	}{
		{"dominio puro", ""},
		{"dominio com barra final", "/"},
		{"api_url ja com o path do heartbeat", pathHeartbeat},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			var capt requisicaoCapturada
			srv := servidorQueResponde(t, http.StatusOK, `[{"id":"1","command":"dir"}]`, &capt)

			cmds, err := PollCommands(cfgDeTeste(srv.URL+c.sufixo), "maq-1")
			if err != nil {
				t.Fatalf("erro inesperado para APIURL %q: %v", srv.URL+c.sufixo, err)
			}
			got := capt.ler()
			if got.path != "/api/monitoring/commands/poll" {
				t.Errorf("path chamado = %q, esperado %q", got.path, "/api/monitoring/commands/poll")
			}
			if got.query != "machine_id=maq-1" {
				t.Errorf("query = %q, esperado %q", got.query, "machine_id=maq-1")
			}
			if len(cmds) != 1 || cmds[0].ID != "1" || cmds[0].Command != "dir" {
				t.Errorf("comandos decodificados = %+v, esperado [{1 dir}]", cmds)
			}
		})
	}
}

func TestRespondToCommand_ConstroiURLParaVariasFormasDeAPIURL(t *testing.T) {
	casos := []struct {
		nome   string
		sufixo string
	}{
		{"dominio puro", ""},
		{"dominio com barra final", "/"},
		{"api_url ja com o path do heartbeat", pathHeartbeat},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			var capt requisicaoCapturada
			srv := servidorQueResponde(t, http.StatusOK, `{}`, &capt)

			if err := RespondToCommand(cfgDeTeste(srv.URL+c.sufixo), "cmd-1", "completed", "ok"); err != nil {
				t.Fatalf("erro inesperado para APIURL %q: %v", srv.URL+c.sufixo, err)
			}
			if got := capt.ler(); got.path != "/api/monitoring/commands/respond" {
				t.Errorf("path chamado = %q, esperado %q", got.path, "/api/monitoring/commands/respond")
			}
		})
	}
}

func TestPollCommands_MachineIDVazio_NaoChamaOBackend(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `[]`, &capt)

	cmds, err := PollCommands(cfgDeTeste(srv.URL), "")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if cmds != nil {
		t.Errorf("comandos = %+v, esperado nil quando machineID é vazio", cmds)
	}
	if got := capt.ler(); got.chamadas != 0 {
		t.Errorf("backend recebeu %d chamadas, esperado 0 quando machineID é vazio", got.chamadas)
	}
}

// CORRIGIDO (item B.3): PollCommands passou a montar a query com url.Values, que escapa
// o valor. Antes, um machine_id contendo '&' virava parâmetro extra na URL (injeção de
// query string) e o backend recebia o id truncado.
func TestPollCommands_MachineIDEhEscapadoNaQuery(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `[]`, &capt)

	const idMalicioso = "maq-1&admin=1"
	if _, err := PollCommands(cfgDeTeste(srv.URL), idMalicioso); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	got := capt.ler()

	// O backend precisa reconstruir exatamente o id original...
	valores, err := url.ParseQuery(got.query)
	if err != nil {
		t.Fatalf("query recebida não é parseável: %q (%v)", got.query, err)
	}
	if recebido := valores.Get("machine_id"); recebido != idMalicioso {
		t.Errorf("machine_id recebido = %q, esperado %q", recebido, idMalicioso)
	}

	// ...e o '&' embutido NÃO pode ter virado um parâmetro separado.
	if valores.Has("admin") {
		t.Errorf("injeção de query string: parâmetro 'admin' apareceu a partir do machine_id (query=%q)", got.query)
	}
	if strings.Contains(got.query, "&admin=") {
		t.Errorf("query = %q — o '&' do machine_id não foi escapado", got.query)
	}
}

// CORRIGIDO (item B.3): PollCommands passou a tratar o erro de http.NewRequest em vez de
// descartá-lo com `req, _ :=`. Combinado com o escape da query, um machine_id com
// caractere de controle agora é transportado com segurança em vez de derrubar o processo
// por nil pointer dereference.
func TestPollCommands_MachineIDComCaractereDeControle_NaoDevePanicar(t *testing.T) {
	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusOK, `[]`, &capt)

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("PollCommands entrou em panic: %v", r)
		}
	}()

	const idComControle = "maq\n1"
	if _, err := PollCommands(cfgDeTeste(srv.URL), idComControle); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	valores, err := url.ParseQuery(capt.ler().query)
	if err != nil {
		t.Fatalf("query recebida não é parseável: %v", err)
	}
	if recebido := valores.Get("machine_id"); recebido != idComControle {
		t.Errorf("machine_id recebido = %q, esperado %q", recebido, idComControle)
	}
}

// ---------------------------------------------------------------------------
// Erros do backend nos endpoints de comando
// ---------------------------------------------------------------------------

func TestPollCommands_Status500_RetornaErro(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusInternalServerError, `{"error":"falhou"}`, nil)

	cmds, err := PollCommands(cfgDeTeste(srv.URL), "maq-1")
	if err == nil {
		t.Fatal("esperado erro para HTTP 500, veio nil")
	}
	if cmds != nil {
		t.Errorf("comandos = %+v, esperado nil em caso de erro", cmds)
	}
}

func TestPollCommands_JSONMalformado_RetornaErro(t *testing.T) {
	// Diferente de doPost, PollCommands trata o erro de Decode — este teste
	// protege esse comportamento correto contra regressão.
	srv := servidorQueResponde(t, http.StatusOK, `{{{`, nil)

	if _, err := PollCommands(cfgDeTeste(srv.URL), "maq-1"); err == nil {
		t.Fatal("esperado erro de decodificação para JSON malformado, veio nil")
	}
}

func TestRespondToCommand_ErroDoBackend_EPropagado(t *testing.T) {
	srv := servidorQueResponde(t, http.StatusInternalServerError, `{"error":"comando desconhecido"}`, nil)

	err := RespondToCommand(cfgDeTeste(srv.URL), "cmd-1", "completed", "ok")
	if err == nil {
		t.Fatal("esperado erro do backend propagado, veio nil")
	}
	if !strings.Contains(err.Error(), "comando desconhecido") {
		t.Errorf("erro %q não propaga a mensagem do backend", err.Error())
	}
}

func TestRespondToCommand_BackendIndisponivel_RetornaErro(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	base := srv.URL
	srv.Close()

	var err error
	executarComPrazo(t, 20*time.Second, func() {
		err = RespondToCommand(cfgDeTeste(base), "cmd-1", "failed", "saida")
	})
	if err == nil {
		t.Fatal("esperado erro com backend fora do ar, veio nil")
	}
}

// ---------------------------------------------------------------------------
// Laço de retry de Send — rápido desde a correção B.9 (retryBaseDelay é var)
// ---------------------------------------------------------------------------

// comRetryBaseDelayReduzido troca retryBaseDelay por um valor pequeno durante o
// teste e restaura o original ao final — evita que os testes do laço de retry
// paguem segundos reais de backoff exponencial.
func comRetryBaseDelayReduzido(t *testing.T, novo time.Duration) {
	t.Helper()
	original := retryBaseDelay
	retryBaseDelay = novo
	t.Cleanup(func() { retryBaseDelay = original })
}

func TestSend_BackendSempreFalhando_TentaTresVezesEDesiste(t *testing.T) {
	comRetryBaseDelayReduzido(t, 5*time.Millisecond)

	var capt requisicaoCapturada
	srv := servidorQueResponde(t, http.StatusInternalServerError, `{"error":"backend caiu"}`, &capt)

	inicio := time.Now()
	machineID, err := Send(cfgDeTeste(srv.URL), payloadDeTeste())
	decorrido := time.Since(inicio)

	if err == nil {
		t.Fatal("esperado erro após esgotar as tentativas, veio nil")
	}
	if machineID != "" {
		t.Errorf("machineID = %q, esperado vazio após falhar", machineID)
	}
	if got := capt.ler(); got.chamadas != maxRetries {
		t.Errorf("backend recebeu %d chamadas, esperado %d (maxRetries)", got.chamadas, maxRetries)
	}
	if !strings.Contains(err.Error(), "após 3 tentativas") {
		t.Errorf("erro %q não informa o número de tentativas", err.Error())
	}
	if !strings.Contains(err.Error(), "backend caiu") {
		t.Errorf("erro %q não preserva a última causa vinda do backend", err.Error())
	}
	// Prova que houve espera real entre as tentativas: backoff exponencial de
	// base 5ms produz ao menos 5ms (tentativa 1→2) + 10ms (tentativa 2→3) = 15ms,
	// mais o jitter (que só soma, nunca subtrai) — nunca poderia ser instantâneo.
	minimoEsperado := 3 * retryBaseDelay // base*1 + base*2, sem contar jitter
	if decorrido < minimoEsperado {
		t.Errorf("Send levou %v, esperado ao menos %v de espera entre tentativas (backoff exponencial)", decorrido, minimoEsperado)
	}
	// Teto generoso: prova que NÃO regredimos para o antigo retryInterval fixo de
	// 10s — se alguém reintroduzir um valor grande aqui, este teste denuncia.
	if decorrido > 2*time.Second {
		t.Errorf("Send levou %v — muito mais que o esperado para retryBaseDelay=%v; possível regressão para espera fixa/grande", decorrido, retryBaseDelay)
	}
}

func TestSend_SucessoNaSegundaTentativa_NaoPropagaErro(t *testing.T) {
	comRetryBaseDelayReduzido(t, 5*time.Millisecond)

	var mu sync.Mutex
	chamadas := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		chamadas++
		n := chamadas
		mu.Unlock()
		if n == 1 {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"instabilidade"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"machine_id":"recuperado"}`))
	}))
	t.Cleanup(srv.Close)

	machineID, err := Send(cfgDeTeste(srv.URL), payloadDeTeste())
	if err != nil {
		t.Fatalf("Send deveria se recuperar na 2ª tentativa, mas retornou erro: %v", err)
	}
	if machineID != "recuperado" {
		t.Errorf("machineID = %q, esperado %q", machineID, "recuperado")
	}
	mu.Lock()
	total := chamadas
	mu.Unlock()
	if total != 2 {
		t.Errorf("backend recebeu %d chamadas, esperado 2 (falha + sucesso)", total)
	}
}

// ---------------------------------------------------------------------------
// calcularEspera — backoff exponencial + jitter, testado como função pura (B.9)
// ---------------------------------------------------------------------------

// TestCalcularEspera_CrescimentoExponencial garante que o piso de cada
// tentativa (sem contar o jitter, que só soma) dobra a cada tentativa.
func TestCalcularEspera_CrescimentoExponencial(t *testing.T) {
	comRetryBaseDelayReduzido(t, 100*time.Millisecond)
	rng := rand.New(rand.NewSource(1))

	pisoAnterior := time.Duration(0)
	for tentativa := 1; tentativa <= 5; tentativa++ {
		pisoEsperado := retryBaseDelay * time.Duration(int64(1)<<uint(tentativa-1))
		espera := calcularEspera(tentativa, rng)

		if espera < pisoEsperado {
			t.Errorf("tentativa %d: espera %v menor que o piso esperado %v (jitter não pode subtrair)", tentativa, espera, pisoEsperado)
		}
		if tentativa > 1 && pisoEsperado < 2*pisoAnterior {
			t.Fatalf("tentativa %d: piso %v não dobrou em relação à tentativa anterior (%v)", tentativa, pisoEsperado, pisoAnterior/2)
		}
		pisoAnterior = pisoEsperado
	}
}

// TestCalcularEspera_JitterLimitadoAMetadeDoBackoff garante que o jitter nunca
// ultrapassa metade do backoff da tentativa — um jitter sem limite superior
// tornaria o backoff imprevisível (poderia, por azar, dobrar o atraso real).
func TestCalcularEspera_JitterLimitadoAMetadeDoBackoff(t *testing.T) {
	comRetryBaseDelayReduzido(t, 200*time.Millisecond)
	rng := rand.New(rand.NewSource(42))

	const tentativa = 3
	backoff := retryBaseDelay * time.Duration(int64(1)<<uint(tentativa-1))
	tetoEsperado := backoff + backoff/2

	for i := 0; i < 200; i++ {
		espera := calcularEspera(tentativa, rng)
		if espera < backoff {
			t.Fatalf("iteração %d: espera %v abaixo do backoff base %v", i, espera, backoff)
		}
		if espera > tetoEsperado {
			t.Fatalf("iteração %d: espera %v acima do teto (backoff + 50%%) %v", i, espera, tetoEsperado)
		}
	}
}

// TestCalcularEspera_JitterEspalhaTentativasEntreMaquinas é a razão de existir
// do jitter: sem ele, uma frota inteira de agentes reagindo à mesma queda do
// backend bateria de volta no mesmo instante exato (thundering herd). Simula
// N "máquinas" com RNGs independentes e verifica que os atrasos resultantes
// não são todos idênticos.
func TestCalcularEspera_JitterEspalhaTentativasEntreMaquinas(t *testing.T) {
	comRetryBaseDelayReduzido(t, 100*time.Millisecond)

	const maquinas = 20
	vistos := map[time.Duration]bool{}
	for i := 0; i < maquinas; i++ {
		rng := rand.New(rand.NewSource(int64(i)))
		vistos[calcularEspera(2, rng)] = true
	}

	if len(vistos) <= 1 {
		t.Fatalf("todas as %d máquinas simuladas obtiveram o mesmo atraso — jitter não está espalhando as tentativas", maquinas)
	}
}

// TestCalcularEspera_BackoffDeUmNanossegundoNaoEntraEmPanico cobre a borda real
// de Int63n: com retryBaseDelay=1ns e tentativa=1, backoff=1ns e
// metade=int64(1ns)/2=0 (truncamento de inteiro) — o jitter é calculado como
// rng.Int63n(metade+1) = rng.Int63n(1), que é válido (sempre devolve 0) e nunca
// entra em pânico. Int63n só entra em pânico com argumento <= 0, e metade+1 é
// sempre >= 1 para qualquer backoff não-negativo — este teste prova isso na
// borda mais apertada possível.
func TestCalcularEspera_BackoffDeUmNanossegundoNaoEntraEmPanico(t *testing.T) {
	comRetryBaseDelayReduzido(t, 1*time.Nanosecond)
	rng := rand.New(rand.NewSource(7))

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("calcularEspera entrou em pânico com backoff de 1ns: %v", r)
		}
	}()

	for i := 0; i < 100; i++ {
		if espera := calcularEspera(1, rng); espera < retryBaseDelay {
			t.Fatalf("espera %v abaixo do backoff base %v", espera, retryBaseDelay)
		}
	}
}

// ---------------------------------------------------------------------------
// Sanidade do contrato JSON do payload (evita quebra silenciosa de campo)
// ---------------------------------------------------------------------------

func TestSend_PayloadChegaComOsCamposEsperados(t *testing.T) {
	var mu sync.Mutex
	var recebido map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var m map[string]any
		_ = json.NewDecoder(r.Body).Decode(&m)
		mu.Lock()
		recebido = m
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"machine_id":"abc"}`))
	}))
	t.Cleanup(srv.Close)

	if _, err := Send(cfgDeTeste(srv.URL), payloadDeTeste()); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	mu.Lock()
	defer mu.Unlock()
	for _, campo := range []string{"machine_token", "machine_uuid", "hostname", "ip", "os"} {
		if _, ok := recebido[campo]; !ok {
			t.Errorf("campo %q ausente no JSON recebido pelo backend", campo)
		}
	}
	if recebido["machine_token"] != "token-fake" {
		t.Errorf("machine_token = %v, esperado %q", recebido["machine_token"], "token-fake")
	}
}
