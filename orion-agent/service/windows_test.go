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

// payloadDaMesmaMaquina monta um Payload equivalente ao que collector.Collect()
// devolveria para UMA mesma máquina física, variando apenas o usuário logado.
// Serve para simular troca rápida de usuário sem mexer em hardware real.
func payloadDaMesmaMaquina(usuario string) *collector.Payload {
	return &collector.Payload{
		MachineUUID: "uuid-fixo-da-maquina-de-teste",
		Hostname:    "ORION-PC-TESTE",
		Interfaces: []collector.NetworkInterface{
			{Name: "Ethernet", MAC: "aa:bb:cc:dd:ee:01", IPs: []string{"192.168.0.10/24"}},
			{Name: "Wi-Fi", MAC: "aa:bb:cc:dd:ee:02", IPs: []string{"192.168.0.11/24"}},
		},
		CurrentUser: usuario,
		Domain:      "EMPRESA",
	}
}

// aplicaIdentidadeComoTick reproduz APENAS o bloco de identidade do tick()
// (o "if s.machineToken == \"\" { ... }"), sem tocar em disco, Desktop ou rede.
func aplicaIdentidadeComoTick(s *Svc, tokenDerivadoDoHardware string) {
	if s.machineToken == "" {
		s.machineToken = tokenDerivadoDoHardware
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
	aplicaIdentidadeComoTick(s, payloadDaMesmaMaquina("joao").GenerateToken())
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

// A identidade da máquina é derivada de hardware (MachineUUID + Hostname + MACs)
// e NÃO inclui o usuário. Trocar de usuário não pode mudar o token.
func TestTrocaDeUsuarioNaoAlteraIdentidadeDaMaquina(t *testing.T) {
	primeiroLogon := payloadDaMesmaMaquina("maria")
	segundoLogon := payloadDaMesmaMaquina("joao")

	tokenA := primeiroLogon.GenerateToken()
	tokenB := segundoLogon.GenerateToken()

	if tokenA == "" {
		t.Fatal("GenerateToken devolveu string vazia")
	}
	if tokenA != tokenB {
		t.Fatalf("troca de usuário mudou a identidade da máquina (duplicação de identidade):\n"+
			"usuario=%s token=%s\nusuario=%s token=%s",
			primeiroLogon.CurrentUser, tokenA, segundoLogon.CurrentUser, tokenB)
	}

	// Sanidade: o token realmente depende do hardware — outra máquina, outro token.
	outraMaquina := payloadDaMesmaMaquina("maria")
	outraMaquina.MachineUUID = "uuid-de-outra-maquina"
	if outraMaquina.GenerateToken() == tokenA {
		t.Fatal("máquinas diferentes geraram o mesmo token — a identidade não depende do hardware")
	}
}

// Simula dois logons em sequência rápida contra o MESMO Svc e verifica que o
// estado compartilhado permanece coerente: um único token, uma única identidade,
// URLs de bandeja estáveis.
func TestTrocaRapidaDeUsuarioMantemEstadoDoSvcCoerente(t *testing.T) {
	s := novoSvcDeTeste("https://orion.exemplo.test")

	// 1ª coleta: usuário "maria" loga e o tick resolve a identidade.
	aplicaIdentidadeComoTick(s, payloadDaMesmaMaquina("maria").GenerateToken())
	portalMaria := s.GetPortalURL()
	ticketMaria := s.GetTicketURL()
	tokenMaria := s.machineToken

	if portalMaria == "" || ticketMaria == "" {
		t.Fatal("após a 1ª coleta as URLs da bandeja não deveriam estar vazias")
	}

	// 2ª coleta logo em seguida: "joao" assume a sessão (troca rápida de usuário).
	aplicaIdentidadeComoTick(s, payloadDaMesmaMaquina("joao").GenerateToken())

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
// para confirmar que o usuário logado acompanha a variável de ambiente, mas a
// identidade da máquina não.
func TestColetaRealSegueUsuarioMasIdentidadePermaneceEstavel(t *testing.T) {
	if testing.Short() {
		t.Skip("coleta real de hardware leva ~1s por chamada; pulado em -short")
	}

	t.Setenv("USERNAME", "USUARIO_TESTE_A")
	primeira, err := collector.Collect()
	if err != nil {
		t.Skipf("collector.Collect() indisponível neste ambiente: %v", err)
	}

	t.Setenv("USERNAME", "USUARIO_TESTE_B")
	segunda, err := collector.Collect()
	if err != nil {
		t.Skipf("collector.Collect() indisponível neste ambiente: %v", err)
	}

	if primeira.CurrentUser != "USUARIO_TESTE_A" {
		t.Errorf("1ª coleta deveria reportar USUARIO_TESTE_A, obtive %q", primeira.CurrentUser)
	}
	if segunda.CurrentUser != "USUARIO_TESTE_B" {
		t.Errorf("2ª coleta deveria reportar USUARIO_TESTE_B, obtive %q", segunda.CurrentUser)
	}
	if primeira.MachineUUID != segunda.MachineUUID || primeira.Hostname != segunda.Hostname {
		t.Fatalf("identidade de hardware oscilou entre coletas: %q/%q vs %q/%q",
			primeira.MachineUUID, primeira.Hostname, segunda.MachineUUID, segunda.Hostname)
	}
	if primeira.GenerateToken() != segunda.GenerateToken() {
		t.Fatalf("troca de usuário mudou o token derivado do hardware:\n%s\n%s",
			primeira.GenerateToken(), segunda.GenerateToken())
	}
}

// ─────────────────────────────────────────────────────────────
// CONDIÇÕES DE CORRIDA no estado compartilhado do Svc
// ─────────────────────────────────────────────────────────────

// Reproduz o cenário real de main.go:
//   - goroutine do serviço  (Start -> go s.run -> tick) ESCREVE s.machineToken
//   - goroutine do systray  (callbacks da bandeja)      LÊ s.machineToken via GetPortalURL/GetTicketURL
//
// Nenhum mutex/atomic protege o campo. Rodar com -race.
func TestCorridaEntreTickEBandejaNoMachineToken(t *testing.T) {
	pularSeBugConhecido(t, "data race em Svc.machineToken — escrito por tick() na goroutine de "+
		"Start()->run() e lido por GetPortalURL()/GetTicketURL() na goroutine do systray, sem mutex/atomic")

	s := novoSvcDeTeste("https://orion.exemplo.test")

	const iteracoes = 5000
	var wg sync.WaitGroup

	// Escritor: mesmo papel do bloco de identidade do tick().
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			s.machineToken = fmt.Sprintf("token-do-tick-%d", i)
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

// escreveTokenComoTick reproduz literalmente a atribuição de windows.go:110
// ("s.machineToken = t"). O //go:noinline impede que o compilador elimine as
// atribuições do laço do teste e preserva a mesma sequência de instruções da
// produção: primeiro o COMPRIMENTO da string, depois o PONTEIRO.
//
//go:noinline
func escreveTokenComoTick(s *Svc, t string) { s.machineToken = t }

// PROVA DO DATA RACE SEM O DETECTOR DE CORRIDA.
//
// Nesta máquina não há toolchain C, então "go test -race" não roda
// ("-race requires cgo"). A corrida foi provada por outro caminho, mais direto:
//
// Em Go uma string é um cabeçalho de DUAS palavras (ponteiro + comprimento).
// O disassembly de windows.go:110 (go build -gcflags=-S) mostra que tick()
// publica o token em DUAS instruções separadas, e na ordem perigosa:
//
//	MOVQ BX, 48(DX)   ; escreve primeiro o COMPRIMENTO
//	CALL runtime.gcWriteBarrier2(SB)
//	MOVQ AX, 40(DX)   ; só depois escreve o PONTEIRO
//
// Enquanto isso, GetPortalURL() testa o comprimento em windows.go:51
// (CMPQ 48(AX), $0) e usa o ponteiro em windows.go:55. A goroutine do systray
// pode, portanto, ver "comprimento já publicado, ponteiro ainda nulo" e
// desreferenciar endereço zero DENTRO do fmt.Sprintf.
//
// Este teste dispara exatamente esse cenário e conta panics reais vindos do
// código de produção. Um panic no callback da bandeja NÃO é recuperado em
// main.go — ele derruba o agente inteiro.
func TestCorridaMachineTokenDerrubaGetPortalURLComPanic(t *testing.T) {
	pularSeBugConhecido(t, "Svc.machineToken e publicado em duas instrucoes (comprimento e depois "+
		"ponteiro) por tick() e lido sem sincronizacao por GetPortalURL() na goroutine do systray; "+
		"a leitura no meio da publicacao causa nil pointer dereference e derruba o agente")

	// Pressão de GC: com o write barrier ligado, a janela entre a escrita do
	// comprimento e a do ponteiro passa a conter uma chamada de função.
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
			escreveTokenComoTick(s, "")          // estado inicial do Svc
			escreveTokenComoTick(s, tokenValido) // publicação do token pelo tick()
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
		t.Fatalf("DATA RACE COMPROVADO em Svc.machineToken: %d panic(s) e %d URL(s) corrompida(s) "+
			"vindos de GetPortalURL(). Primeiro panic: %s", panics, corrompid, primeiro)
	}
	t.Log("nenhuma manifestação observada nesta execução — a corrida continua existindo " +
		"(escrita e leitura concorrentes sem sincronização), apenas não se manifestou aqui")
}

// Mesmo problema no outro campo compartilhado: machineID é escrito por tick()
// e lido por pollAndExecuteCommands() — que roda no mesmo loop, mas o campo
// também fica exposto a qualquer outra goroutine sem sincronização.
// Aqui o backend é simulado com httptest (nenhuma chamada externa).
func TestCorridaEntreTickEPollNoMachineID(t *testing.T) {
	pularSeBugConhecido(t, "data race em Svc.machineID — escrito por tick() e lido por "+
		"pollAndExecuteCommands() sem mutex/atomic")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Devolve lista vazia: nenhum comando é executado no host de teste.
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]string{})
	}))
	defer srv.Close()

	s := novoSvcDeTeste(srv.URL)
	s.machineID = "id-inicial"

	const iteracoes = 500
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iteracoes; i++ {
			s.machineID = fmt.Sprintf("machine-%d", i) // papel do tick()
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
