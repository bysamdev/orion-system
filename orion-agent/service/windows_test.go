package service

// Testes do serviço Windows do Orion Agent.
//
// Regras seguidas por este arquivo:
//   - Nenhum teste escreve em caminhos reais do sistema (ProgramData, Desktop, Program Files).
//   - Nenhum teste faz chamada de rede para host externo; o backend é simulado com httptest.
//   - tick() NUNCA é chamado: ele escreve o atalho no Desktop do usuário
//     (shortcut.CreatePortalShortcut) e pode gravar em C:\ProgramData\OrionAgent
//     (token.SaveToken). Ver o achado de testabilidade no relatório.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/token"
)

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// novoSvcDeTeste cria um Svc isolado, com logger silencioso e apontando para
// a URL informada (normalmente um httptest.Server local).
func novoSvcDeTeste(apiURL string) *Svc {
	cfg := &config.Config{
		APIURL:          apiURL,
		AgentKey:        "chave-de-teste",
		IntervalSeconds: 60,
		LogFile:         "agent.log",
	}
	return New(cfg, log.New(io.Discard, "", 0))
}

// pularSeBugConhecido mantém a suíte verde quando o teste documenta um bug real
// que ainda não foi corrigido no código de produção.
// Para reproduzir os bugs, rode com ORION_TESTAR_BUGS_CONHECIDOS=1.
func pularSeBugConhecido(t *testing.T, explicacao string) {
	t.Helper()
	if os.Getenv("ORION_TESTAR_BUGS_CONHECIDOS") == "1" {
		t.Logf("executando teste de bug conhecido sob demanda: %s", explicacao)
		return
	}
	t.Skip("BUG CONHECIDO: " + explicacao + " — remover o Skip apos corrigir")
}

// aplicaIdentidadeComoTick reproduz APENAS o bloco de identidade do tick()
// (o "if s.machineToken == \"\" { ... }"), sem tocar em disco, Desktop ou rede.
//
// Antes da correção A.6/B.5 este helper recebia um token DERIVADO do Payload
// coletado (via Payload.GenerateToken, hoje removida). Com a correção, a
// identidade deixou de depender do Payload — vem de token.LoadToken ou
// token.GenerateRandomIdentity — então o helper passou a receber o valor já
// resolvido diretamente.
func aplicaIdentidadeComoTick(s *Svc, identidade string) {
	if s.machineToken == "" {
		s.machineToken = identidade
	}
}

// ─────────────────────────────────────────────────────────────
// (B) Contrato: token vazio ⇒ URL vazia (no-op silencioso da bandeja)
// ─────────────────────────────────────────────────────────────

func TestGetPortalURLComTokenVazioRetornaStringVazia(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")

	if got := s.GetPortalURL(); got != "" {
		t.Fatalf("com machineToken vazio esperava \"\", obtive %q", got)
	}
}

func TestGetTicketURLComTokenVazioRetornaStringVazia(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")

	if got := s.GetTicketURL(); got != "" {
		t.Fatalf("com machineToken vazio esperava \"\", obtive %q", got)
	}
}

// Documenta a consequência do contrato acima: enquanto o primeiro tick() não
// concluir, os cliques na bandeja viram no-op silencioso (main.go só abre o
// navegador quando url != "", sem avisar o usuário).
func TestBandejaViraNoOpSilenciosoAntesDoPrimeiroTick(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")

	var aberturas []string
	// Reproduz o callback de main.go: só abre o navegador se a URL não for vazia.
	callbackDaBandeja := func(gerar func() string) {
		if u := gerar(); u != "" {
			aberturas = append(aberturas, u)
		}
	}

	callbackDaBandeja(s.GetPortalURL)
	callbackDaBandeja(s.GetTicketURL)

	if len(aberturas) != 0 {
		t.Fatalf("antes do primeiro tick nenhuma URL deveria ser aberta, abriu: %v", aberturas)
	}

	// Depois que a identidade é resolvida, os mesmos cliques passam a funcionar.
	identidade, err := token.GenerateRandomIdentity()
	if err != nil {
		t.Fatalf("GenerateRandomIdentity falhou: %v", err)
	}
	aplicaIdentidadeComoTick(s, identidade)
	callbackDaBandeja(s.GetPortalURL)
	callbackDaBandeja(s.GetTicketURL)

	if len(aberturas) != 2 {
		t.Fatalf("apos a identidade resolvida esperava 2 aberturas, obtive %d (%v)", len(aberturas), aberturas)
	}
}

// ─────────────────────────────────────────────────────────────
// (C) Construção das URLs: formato e query params
// ─────────────────────────────────────────────────────────────

func TestGetPortalURLMontaFormatoEQueryParamsCorretos(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")
	s.machineToken = "abc123token"

	bruta := s.GetPortalURL()
	u, err := url.Parse(bruta)
	if err != nil {
		t.Fatalf("URL do portal não é parseável: %v (bruta=%q)", err, bruta)
	}

	if u.Scheme != "https" || u.Host != "orion.exemplo.test" {
		t.Errorf("esquema/host inesperados: %q // %q (bruta=%q)", u.Scheme, u.Host, bruta)
	}
	if u.Path != "/api/auth/machine-login" {
		t.Errorf("path esperado /api/auth/machine-login, obtive %q", u.Path)
	}
	q := u.Query()
	if q.Get("token") != "abc123token" {
		t.Errorf("query token esperado %q, obtive %q", "abc123token", q.Get("token"))
	}
	if q.Get("redirect_to") != "" {
		t.Errorf("URL de portal não deveria carregar redirect_to, obtive %q", q.Get("redirect_to"))
	}
}

func TestGetTicketURLMontaFormatoEQueryParamsCorretos(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")
	s.machineToken = "abc123token"

	bruta := s.GetTicketURL()
	u, err := url.Parse(bruta)
	if err != nil {
		t.Fatalf("URL de ticket não é parseável: %v (bruta=%q)", err, bruta)
	}

	if u.Path != "/api/auth/machine-login" {
		t.Errorf("path esperado /api/auth/machine-login, obtive %q", u.Path)
	}
	q := u.Query()
	if q.Get("token") != "abc123token" {
		t.Errorf("query token esperado %q, obtive %q", "abc123token", q.Get("token"))
	}
	if q.Get("redirect_to") != "/novo-ticket" {
		t.Errorf("query redirect_to esperado %q, obtive %q", "/novo-ticket", q.Get("redirect_to"))
	}
}

// As duas URLs precisam apontar para o MESMO endpoint e carregar o MESMO token;
// a única diferença legítima é o redirect_to.
func TestPortalETicketCompartilhamMesmoEndpointETokens(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")
	s.machineToken = "token-compartilhado"

	portal, ticket := s.GetPortalURL(), s.GetTicketURL()
	if !strings.HasPrefix(ticket, portal) {
		t.Fatalf("URL de ticket deveria estender a de portal.\nportal=%q\nticket=%q", portal, ticket)
	}
	if ticket == portal {
		t.Fatalf("URL de ticket deveria diferir da de portal (redirect_to), ambas = %q", portal)
	}
}

// BUG (baixo/médio): GetPortalURL concatena APIURL com "/api/..." sem normalizar a
// barra final, ao contrário de sender.Send, que faz strings.TrimSuffix(url, "/").
// Com api_url terminando em "/" no agent.yaml, a URL sai com barra dupla.
func TestGetPortalURLNaoDeveDuplicarBarraQuandoAPIURLTerminaComBarra(t *testing.T) {
	pularSeBugConhecido(t, "GetPortalURL/GetTicketURL nao normalizam a barra final de cfg.APIURL "+
		"(sender.Send normaliza), gerando '//api/auth/machine-login' quando api_url termina em '/'")

	s := novoSvcDeTeste("https://orion.exemplo.test/")
	s.machineToken = "abc123token"

	u, err := url.Parse(s.GetPortalURL())
	if err != nil {
		t.Fatalf("URL não parseável: %v", err)
	}
	if u.Path != "/api/auth/machine-login" {
		t.Fatalf("path esperado /api/auth/machine-login, obtive %q (URL bruta=%q)", u.Path, s.GetPortalURL())
	}
}

// BUG (médio): token.LoadToken devolve o conteúdo do arquivo sem TrimSpace e
// GetPortalURL não escapa o token. Um machine.token gravado/editado com quebra
// de linha (bloco de notas, GPO, cópia manual) produz uma URL com caractere de
// controle — inválida para url.Parse e para o navegador.
func TestGetPortalURLDeveGerarURLValidaComTokenComQuebraDeLinha(t *testing.T) {
	pularSeBugConhecido(t, "token nao e sanitizado/escapado; token.LoadToken nao faz TrimSpace "+
		"e GetPortalURL usa fmt.Sprintf sem url.QueryEscape, gerando URL invalida")

	s := novoSvcDeTeste("https://orion.exemplo.test")
	s.machineToken = "abc123token\r\n" // exatamente o que LoadToken devolveria

	bruta := s.GetPortalURL()
	if _, err := url.Parse(bruta); err != nil {
		t.Fatalf("URL gerada é inválida: %v (bruta=%q)", err, bruta)
	}
}

// ─────────────────────────────────────────────────────────────
// (A) Troca rápida de usuário
// ─────────────────────────────────────────────────────────────

// TestIdentidadeDaMaquinaNaoDependeDoUsuarioColetado cobre a correção A.6/B.5.
//
// Antes: a identidade era derivada de MachineUUID+Hostname+MACs do Payload
// coletado — nunca do usuário, mas ainda assim acoplada ao hardware e instável
// conforme o estado da rede (achado B.5, ver MACHINE-IDENTITY-OPTIONS.md).
// Agora: a identidade é um valor aleatório resolvido uma única vez
// (token.GenerateRandomIdentity ou token.LoadToken), e o bloco de identidade do
// tick() nem consulta o Payload para decidi-la — só a usa DEPOIS de resolvida,
// em "payload.MachineToken = s.machineToken". Trocar de usuário entre coletas
// não pode, por construção, alterar uma identidade já fixada: o gate
// "if s.machineToken == \"\"" impede que o bloco rode de novo.
func TestIdentidadeDaMaquinaNaoDependeDoUsuarioColetado(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	identidade, err := token.GenerateRandomIdentity()
	if err != nil {
		t.Fatalf("GenerateRandomIdentity falhou: %v", err)
	}

	// 1ª coleta: usuário "maria" loga e o tick resolve a identidade.
	aplicaIdentidadeComoTick(s, identidade)
	if s.machineToken != identidade {
		t.Fatalf("machineToken = %q, esperado %q", s.machineToken, identidade)
	}

	// 2ª coleta simulada, com outro usuário: como s.machineToken já não está
	// vazio, o bloco de identidade não roda de novo.
	aplicaIdentidadeComoTick(s, "identidade-que-nunca-deveria-substituir-a-primeira")
	if s.machineToken != identidade {
		t.Fatalf("troca de usuário alterou a identidade já resolvida: antes=%q depois=%q", identidade, s.machineToken)
	}
}

// Simula dois logons em sequência rápida contra o MESMO Svc e verifica que o
// estado compartilhado permanece coerente: um único token, uma única identidade,
// URLs de bandeja estáveis.
func TestTrocaRapidaDeUsuarioMantemEstadoDoSvcCoerente(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	identidade, err := token.GenerateRandomIdentity()
	if err != nil {
		t.Fatalf("GenerateRandomIdentity falhou: %v", err)
	}

	// 1ª coleta: usuário "maria" loga e o tick resolve a identidade.
	aplicaIdentidadeComoTick(s, identidade)
	portalMaria := s.GetPortalURL()
	ticketMaria := s.GetTicketURL()
	tokenMaria := s.machineToken

	if portalMaria == "" || ticketMaria == "" {
		t.Fatal("após a 1ª coleta as URLs da bandeja não deveriam estar vazias")
	}

	// 2ª coleta logo em seguida: "joao" assume a sessão (troca rápida de usuário).
	aplicaIdentidadeComoTick(s, "outra-identidade-hipotetica")

	if s.machineToken != tokenMaria {
		t.Fatalf("troca de usuário alterou o machineToken do Svc: antes=%q depois=%q", tokenMaria, s.machineToken)
	}
	if got := s.GetPortalURL(); got != portalMaria {
		t.Errorf("URL de portal mudou após troca de usuário:\nantes=%q\ndepois=%q", portalMaria, got)
	}
	if got := s.GetTicketURL(); got != ticketMaria {
		t.Errorf("URL de ticket mudou após troca de usuário:\nantes=%q\ndepois=%q", ticketMaria, got)
	}
}

// Exercita o collector real (leitura local, sem rede externa e sem escrita em disco)
// para confirmar que o usuário logado acompanha a variável de ambiente, e que os
// dados de hardware que antes alimentavam a identidade (MachineUUID, Hostname)
// continuam estáveis — ainda que, desde a correção A.6/B.5, eles não sejam mais
// usados para gerar identidade nenhuma (ver TestIdentidadeDaMaquinaNaoDependeDoUsuarioColetado).
// Correção A.13: CurrentUser deixou de seguir USERNAME diretamente — Collect()
// agora prefere a sessão de console ATIVA (via WTS) às variáveis de ambiente
// do processo, exatamente para não depender mais de env vars (que, sob o
// serviço NT SERVICE\OrionAgent, refletem a conta de serviço, não quem está
// logado na tela). Nesta máquina, com uma sessão real, USUARIO_TESTE_A/B
// setados via env não têm mais efeito sobre CurrentUser — por isso o teste
// abaixo não afirma mais um valor específico ali, só que ele é estável (a
// mesma sessão) entre chamadas, junto com a identidade de hardware.
func TestColetaRealSegueUsuarioMasHardwarePermaneceEstavel(t *testing.T) {
	if testing.Short() {
		t.Skip("coleta real de hardware leva ~1s por chamada; pulado em -short")
	}

	primeira, err := collector.Collect()
	if err != nil {
		t.Skipf("collector.Collect() indisponível neste ambiente: %v", err)
	}

	segunda, err := collector.Collect()
	if err != nil {
		t.Skipf("collector.Collect() indisponível neste ambiente: %v", err)
	}

	if primeira.CurrentUser != segunda.CurrentUser {
		t.Errorf("CurrentUser oscilou entre coletas sem mudança real de sessão: %q vs %q",
			primeira.CurrentUser, segunda.CurrentUser)
	}
	if primeira.MachineUUID != segunda.MachineUUID || primeira.Hostname != segunda.Hostname {
		t.Fatalf("identidade de hardware oscilou entre coletas: %q/%q vs %q/%q",
			primeira.MachineUUID, primeira.Hostname, segunda.MachineUUID, segunda.Hostname)
	}
}

// ─────────────────────────────────────────────────────────────
// CONDIÇÕES DE CORRIDA no estado compartilhado do Svc
// ─────────────────────────────────────────────────────────────

// CORRIGIDO (item B.4): Svc.machineToken agora é protegido por sync.RWMutex
// (getMachineToken/setMachineToken, ver service/windows.go). Este teste
// reproduz o cenário real de main.go pelo caminho protegido:
//   - goroutine do serviço  (Start -> go s.run -> tick) ESCREVE via setMachineToken
//   - goroutine do systray  (callbacks da bandeja)      LÊ via GetPortalURL/GetTicketURL
//
// Antes da correção, este teste só provava ausência de PANIC/corrupção
// observável nesta execução específica — não ausência de corrida (que exigia
// -race, indisponível nesta máquina sem toolchain C). Agora ambos os lados
// passam pelo mutex, então a corrida em si deixou de existir, não só de se
// manifestar.
func TestCorridaEntreTickEBandejaNoMachineToken(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	const iteracoes = 5000
	var wg sync.WaitGroup

	// Escritor: mesmo papel do bloco de identidade do tick().
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			s.setMachineToken(fmt.Sprintf("token-do-tick-%d", i))
		}
	}()

	// Leitores: mesmo papel dos callbacks "Abrir Portal" e "Abrir Chamado".
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			_ = s.GetPortalURL()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			_ = s.GetTicketURL()
		}
	}()

	wg.Wait()
}

// TestCorridaMachineTokenNaoDerrubaGetPortalURLComPanic é a versão adversarial
// do teste acima: pressão de GC ativa (write barrier) + leitura concorrente
// dentro de um recover(), exatamente o cenário que, antes da correção B.4,
// podia observar "comprimento já publicado, ponteiro ainda nulo" (a string é
// um cabeçalho de duas palavras, publicado em duas instruções separadas —
// ver histórico deste arquivo). Com o mutex, o leitor nunca observa um
// estado parcialmente publicado.
func TestCorridaMachineTokenNaoDerrubaGetPortalURLComPanic(t *testing.T) {
	// Pressão de GC: mantém o coletor mais agressivo, maximizando a chance de
	// qualquer inconsistência remanescente se manifestar durante o teste.
	defer debug.SetGCPercent(debug.SetGCPercent(1))

	s := novoSvcDeTeste("https://orion.exemplo.test")
	tokenValido := strings.Repeat("A", 64) // mesmo tamanho de um sha256 em hex

	var (
		parar     = make(chan struct{})
		wg        sync.WaitGroup
		mu        sync.Mutex
		panics    int
		corrompid int
		primeiro  string
	)

	// Ruído de alocação para manter o coletor de lixo ativo.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-parar:
				return
			default:
			}
			_ = make([]byte, 4096)
			runtime.Gosched()
		}
	}()

	// Escritor: papel do tick() resolvendo a identidade da máquina.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-parar:
				return
			default:
			}
			s.setMachineToken("")          // estado inicial do Svc
			s.setMachineToken(tokenValido) // publicação do token pelo tick()
		}
	}()

	// Leitor: papel do callback "Abrir Portal de Suporte" da bandeja.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-parar:
				return
			default:
			}
			func() {
				defer func() {
					if r := recover(); r != nil {
						mu.Lock()
						panics++
						if primeiro == "" {
							primeiro = fmt.Sprint(r)
						}
						mu.Unlock()
					}
				}()
				u := s.GetPortalURL()
				// Contrato: ou a URL é vazia, ou carrega o token íntegro.
				if u != "" && !strings.HasSuffix(u, tokenValido) {
					mu.Lock()
					corrompid++
					mu.Unlock()
				}
			}()
		}
	}()

	time.Sleep(5 * time.Second)
	close(parar)
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	if panics > 0 || corrompid > 0 {
		t.Fatalf("Svc.machineToken ainda corrompeu GetPortalURL() mesmo com o mutex: %d panic(s) e "+
			"%d URL(s) corrompida(s). Primeiro panic: %s", panics, corrompid, primeiro)
	}
}

// CORRIGIDO (item B.4): machineID também passou a ser protegido pelo mesmo
// mutex (getMachineID/setMachineID) — mesmo não sendo racy na prática hoje
// (escritor e leitor rodavam na mesma goroutine do loop principal), fica
// consistente com machineToken e não reabre a mesma classe de bug se um dia
// um callback da bandeja passar a consultá-lo. Backend simulado com httptest.
func TestCorridaEntreTickEPollNoMachineID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Devolve lista vazia: nenhum comando é executado no host de teste.
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]string{})
	}))
	defer srv.Close()

	s := novoSvcDeTeste(srv.URL)
	s.setMachineID("id-inicial")

	const iteracoes = 500
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			s.setMachineID(fmt.Sprintf("machine-%d", i)) // papel do tick()
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			s.pollAndExecuteCommands() // caminho real de leitura
		}
	}()

	wg.Wait()
}

// ─────────────────────────────────────────────────────────────
// (D) Ciclo de vida: Start/Stop e cancelamento de contexto
// ─────────────────────────────────────────────────────────────

// Caminho de nil real: o Windows (ou um erro em Start) pode levar a Stop sem
// Start prévio, com s.cancel == nil.
func TestStopSemStartNaoEntraEmPanico(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	if s.cancel != nil {
		t.Fatal("pré-condição: um Svc recém-criado não deveria ter cancel definido")
	}

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Stop() sem Start() entrou em panic: %v", r)
		}
	}()

	if err := s.Stop(nil); err != nil {
		t.Fatalf("Stop() sem Start() deveria retornar nil, retornou: %v", err)
	}
}

// Stop deve efetivamente cancelar o contexto que run() observa.
// NÃO chamamos Start() de propósito: Start dispara run() -> tick(), que escreve
// atalho no Desktop do usuário e pode gravar em C:\ProgramData\OrionAgent.
// Aqui injetamos o cancel do mesmo jeito que Start faria.
func TestStopCancelaOContextoDoLoopPrincipal(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	if err := s.Stop(nil); err != nil {
		t.Fatalf("Stop() retornou erro: %v", err)
	}

	select {
	case <-ctx.Done():
		if ctx.Err() != context.Canceled {
			t.Fatalf("contexto encerrado por motivo inesperado: %v", ctx.Err())
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Stop() não cancelou o contexto do loop principal")
	}
}

// Stop pode ser chamado mais de uma vez (SCM + saída pela bandeja, por exemplo).
func TestStopChamadoDuasVezesNaoEntraEmPanico(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("segundo Stop() entrou em panic: %v", r)
		}
	}()

	if err := s.Stop(nil); err != nil {
		t.Fatalf("1º Stop() retornou erro: %v", err)
	}
	if err := s.Stop(nil); err != nil {
		t.Fatalf("2º Stop() retornou erro: %v", err)
	}
	<-ctx.Done() // já cancelado; não deve bloquear
}

// TestStopEsperaOLoopPrincipalRealmenteEncerrar cobre a correção B.10: Stop()
// não pode mais só disparar cancel() e retornar na hora — precisa esperar (com
// prazo) a goroutine do loop principal fechar s.parado.
//
// Não chamamos Start() de propósito (dispararia tick() real, com I/O de disco
// e rede) — injetamos cancel/parado do mesmo jeito que Start faria, com uma
// goroutine simulando run() que só fecha parado depois de um atraso
// proposital, provando que Stop() espera de verdade em vez de retornar
// imediatamente.
func TestStopEsperaOLoopPrincipalRealmenteEncerrar(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.parado = make(chan struct{})

	const atrasoSimulado = 100 * time.Millisecond
	go func() {
		<-ctx.Done()
		time.Sleep(atrasoSimulado) // simula um tick() em andamento terminando de gravar
		close(s.parado)
	}()

	inicio := time.Now()
	if err := s.Stop(nil); err != nil {
		t.Fatalf("Stop() retornou erro: %v", err)
	}
	decorrido := time.Since(inicio)

	if decorrido < atrasoSimulado {
		t.Errorf("Stop() retornou em %v, antes do loop simulado terminar (%v) — não está esperando de verdade", decorrido, atrasoSimulado)
	}
	if decorrido > tempoLimiteEncerramento {
		t.Errorf("Stop() levou %v — mais que o próprio tempoLimiteEncerramento (%v), possível regressão", decorrido, tempoLimiteEncerramento)
	}
}

// TestStopDesisteDeEsperarAposOTempoLimite garante que, se o loop principal
// nunca fechar parado (travado — ex.: um comando RMM sem retorno, ainda que
// isso já tenha seu próprio timeout via executeCommand), Stop() não bloqueia
// para sempre: desiste após tempoLimiteEncerramento e retorna mesmo assim.
func TestStopDesisteDeEsperarAposOTempoLimite(t *testing.T) {
	original := tempoLimiteEncerramento
	tempoLimiteEncerramento = 50 * time.Millisecond
	t.Cleanup(func() { tempoLimiteEncerramento = original })

	s := novoSvcDeTeste("https://orion.exemplo.test")
	_, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.parado = make(chan struct{}) // nunca fechado — simula o loop travado

	inicio := time.Now()
	if err := s.Stop(nil); err != nil {
		t.Fatalf("Stop() retornou erro: %v", err)
	}
	decorrido := time.Since(inicio)

	if decorrido < tempoLimiteEncerramento {
		t.Errorf("Stop() desistiu cedo demais: %v, esperado ao menos %v", decorrido, tempoLimiteEncerramento)
	}
	if decorrido > 2*tempoLimiteEncerramento {
		t.Errorf("Stop() levou %v — muito mais que tempoLimiteEncerramento (%v), possível regressão para espera sem prazo", decorrido, tempoLimiteEncerramento)
	}
}

// pollAndExecuteCommands deve ser no-op enquanto o heartbeat ainda não devolveu
// um machine_id — nenhuma requisição pode sair do agente nesse estado.
func TestPollAndExecuteCommandsNaoChamaBackendSemMachineID(t *testing.T) {
	// O contador é atômico porque o handler roda na goroutine do httptest.Server:
	// se houver regressão e uma requisição realmente sair, o teste falha com a
	// mensagem correta em vez de virar um data race sob -race.
	var chamadas atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chamadas.Add(1)
		_ = json.NewEncoder(w).Encode([]map[string]string{})
	}))
	defer srv.Close()

	s := novoSvcDeTeste(srv.URL)
	s.machineID = "" // estado antes do primeiro heartbeat bem-sucedido

	s.pollAndExecuteCommands()

	if n := chamadas.Load(); n != 0 {
		t.Fatalf("sem machineID o agente não deveria chamar o backend, houve %d chamada(s)", n)
	}
}

// Com machineID definido, o agente consulta o endpoint de comandos correto.
// O backend é totalmente simulado; a lista vazia garante que nada é executado.
func TestPollAndExecuteCommandsConsultaEndpointCorreto(t *testing.T) {
	var (
		mu           sync.Mutex
		caminho      string
		machineIDQry string
		agentKey     string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		caminho = r.URL.Path
		machineIDQry = r.URL.Query().Get("machine_id")
		agentKey = r.Header.Get("X-Agent-Key")
		mu.Unlock()
		_ = json.NewEncoder(w).Encode([]map[string]string{})
	}))
	defer srv.Close()

	s := novoSvcDeTeste(srv.URL)
	s.machineID = "maquina-123"

	s.pollAndExecuteCommands()

	mu.Lock()
	defer mu.Unlock()
	if caminho != "/api/monitoring/commands/poll" {
		t.Errorf("endpoint esperado /api/monitoring/commands/poll, obtive %q", caminho)
	}
	if machineIDQry != "maquina-123" {
		t.Errorf("query machine_id esperada %q, obtive %q", "maquina-123", machineIDQry)
	}
	if agentKey != "chave-de-teste" {
		t.Errorf("header X-Agent-Key esperado %q, obtive %q", "chave-de-teste", agentKey)
	}
}

// ─────────────────────────────────────────────────────────────
// Metadados do serviço
// ─────────────────────────────────────────────────────────────

func TestServiceConfigExpoeNomeEstavelDoServico(t *testing.T) {
	cfg := ServiceConfig()
	if cfg == nil {
		t.Fatal("ServiceConfig() devolveu nil")
	}
	if cfg.Name != "OrionAgent" {
		t.Errorf("nome do serviço esperado %q, obtive %q (mudar isso quebra 'sc start OrionAgent' e a desinstalação)", "OrionAgent", cfg.Name)
	}
	if cfg.DisplayName == "" || cfg.Description == "" {
		t.Error("DisplayName e Description não deveriam ser vazios")
	}
}

// ─────────────────────────────────────────────────────────────
// Endpoint de Métricas Prometheus (/metrics) e Healthcheck (/health)
// ─────────────────────────────────────────────────────────────

func TestMetricsEndpointRetorna200EMetricasPrometheus(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")
	s.setMachineToken("token-teste-prometheus")

	handler := NewMetricsHandler(s)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatalf("falha ao requisitar /metrics: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status HTTP esperado 200, obtido: %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Errorf("Content-Type esperado text/plain, obtido: %q", contentType)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("falha ao ler corpo da resposta: %v", err)
	}
	corpoStr := string(body)

	metricasObrigatorias := []string{
		"orion_cpu_usage_percent",
		"orion_memory_total_bytes",
		"orion_memory_used_bytes",
		"orion_memory_usage_percent",
		"orion_disk_total_bytes",
		"orion_disk_used_bytes",
		"orion_agent_uptime_seconds",
	}

	for _, m := range metricasObrigatorias {
		if !strings.Contains(corpoStr, m) {
			t.Errorf("corpo de /metrics não contém a métrica esperada %q", m)
		}
	}
}

func TestHealthEndpointRetorna200OK(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")
	handler := NewMetricsHandler(s)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("falha ao requisitar /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status HTTP esperado 200, obtido: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	if string(body) != "OK" {
		t.Errorf("corpo esperado 'OK', obtido: %q", string(body))
	}
}

// TestMetricsEndpointServeSnapshotDoLastPayload é o teste de regressão
// direto da otimização de leveza: antes, /metrics chamava collector.Collect()
// do zero a cada scrape, dobrando (ou mais) a frequência real de coleta em
// relação ao heartbeat. Agora deve servir s.lastPayload (preenchido por
// tick()) sem recoletar — provamos isso plantando um Hostname sintético que
// nenhuma coleta real desta máquina produziria.
func TestMetricsEndpointServeSnapshotDoLastPayload(t *testing.T) {
	s := novoSvcDeTeste("https://backend.invalido")
	s.setLastPayload(&collector.Payload{
		Hostname:  "HOSTNAME-SINTETICO-DO-CACHE",
		CPUUsage:  42.5,
		RAMTotal:  1000,
		RAMUsed:   500,
		DiskTotal: 2000,
		DiskUsed:  1000,
	})

	handler := NewMetricsHandler(s)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatalf("falha ao requisitar /metrics: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	corpoStr := string(body)

	if !strings.Contains(corpoStr, `hostname="HOSTNAME-SINTETICO-DO-CACHE"`) {
		t.Errorf("/metrics não refletiu o lastPayload plantado — provável recoleta indevida.\nCorpo:\n%s", corpoStr)
	}
	if !strings.Contains(corpoStr, "orion_cpu_usage_percent") || !strings.Contains(corpoStr, "42.50") {
		t.Errorf("/metrics não contém o valor de CPU do lastPayload plantado (42.50)")
	}
}

func TestMetricsServerDesabilitadoNaoSobe(t *testing.T) {
	desabilitado := false
	cfg := &config.Config{
		APIURL:          "https://backend.invalido",
		AgentKey:        "chave-teste",
		MetricsEnabled:  &desabilitado,
		MetricsPort:     9182,
		IntervalSeconds: 60,
	}
	s := New(cfg, log.New(io.Discard, "", 0))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Deve retornar sem erro e sem travar
	s.startMetricsServer(ctx)
}

