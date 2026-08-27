package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/kardianos/service"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
	"orion-agent/shortcut"
	"orion-agent/token"
	"orion-agent/version"
)

// jitterDuration adiciona uma variação aleatória de +/- percent% em torno de base
// para evitar que centenas ou milhares de máquinas atinjam o servidor no mesmo milissegundo (thundering herd).
func jitterDuration(base time.Duration, percent float64) time.Duration {
	if percent <= 0 || base <= 0 {
		return base
	}
	n, err := rand.Int(rand.Reader, big.NewInt(2000))
	if err != nil {
		return base
	}
	factor := (float64(n.Int64()-1000) / 1000.0) * (percent / 100.0)
	jitter := float64(base) * (1.0 + factor)
	if jitter <= 0 {
		return base
	}
	return time.Duration(jitter)
}

// tempoLimiteEncerramento é o prazo que Stop() espera o loop principal (run())
// realmente terminar antes de desistir e retornar mesmo assim. É var, não
// const, para que os testes possam reduzi-lo — mesmo padrão de
// sender.retryBaseDelay (correção B.9).
var tempoLimiteEncerramento = 5 * time.Second

// Svc implementa a interface service.Interface necessária para rodar como serviço Windows.
type Svc struct {
	cfg    *config.Config
	logger *log.Logger
	cancel context.CancelFunc

	// parado é fechado quando run() retorna, permitindo que Stop() espere o
	// encerramento de verdade em vez de só disparar o cancelamento e seguir
	// em frente (correção B.10). Antes, Stop() só chamava cancel() sem
	// esperar nada — se o processo terminasse logo em seguida (ex.:
	// os.Exit(0) no menu "Sair" da bandeja, também corrigido nesta mesma
	// correção), um tick() em andamento podia ser cortado no meio de uma
	// escrita (token.SaveToken, o atalho do Desktop), deixando o arquivo
	// truncado ou corrompido.
	parado chan struct{}

	// mu protege machineID e machineToken. A corrida real e comprovada era em
	// machineToken: escrito por tick() na goroutine do loop principal
	// (Start -> go s.run(ctx)) e lido por GetPortalURL/GetTicketURL na
	// goroutine do systray, sem nenhuma sincronização — ver
	// service/windows_test.go (TestCorridaMachineTokenDerrubaGetPortalURLComPanic).
	// machineID hoje só é lido pela própria goroutine do loop
	// (pollAndExecuteCommands), então não é racy na prática — mas fica sob o
	// mesmo mutex por consistência, para não reabrir a mesma classe de bug se
	// um dia um callback da bandeja passar a consultá-lo também.
	mu           sync.RWMutex
	machineID    string
	machineToken string

	// lastPayload é o snapshot mais recente produzido por tick() — reaproveitado
	// pelo endpoint /metrics (startMetricsServer) em vez de cada scrape do
	// Prometheus disparar um collector.Collect() novo. Sem isso, a coleta
	// completa (incluindo os módulos caros de Security/RemoteSoftware — ver
	// collector/expensive_cache.go) rodava tanto no ciclo do heartbeat
	// (interval_seconds, 30s) quanto a cada scrape (15s), quase triplicando a
	// frequência real de coleta.
	lastPayload *collector.Payload
}

func (s *Svc) getMachineToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.machineToken
}

func (s *Svc) setMachineToken(t string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.machineToken = t
}

func (s *Svc) getMachineID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.machineID
}

func (s *Svc) setMachineID(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.machineID = id
}

func (s *Svc) getLastPayload() *collector.Payload {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastPayload
}

func (s *Svc) setLastPayload(p *collector.Payload) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastPayload = p
}

// New cria uma nova instância do serviço com as dependências necessárias.
func New(cfg *config.Config, logger *log.Logger) *Svc {
	return &Svc{cfg: cfg, logger: logger}
}

// Start é chamado pelo Windows quando o serviço é iniciado.
func (s *Svc) Start(svc service.Service) error {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.parado = make(chan struct{})
	go func() {
		defer close(s.parado)
		s.run(ctx) // A lógica real roda em uma goroutine separada
	}()
	return nil
}

// Stop é chamado pelo Windows quando o serviço é encerrado — e, desde a
// correção B.10, também diretamente pelo callback "Sair" da bandeja
// (main.go), no lugar de um os.Exit(0) abrupto.
//
// Cancela o contexto que run() observa e ESPERA (com prazo) a goroutine do
// loop principal realmente retornar antes de devolver o controle — sem essa
// espera, o processo podia terminar com um tick() cortado no meio de uma
// escrita em disco.
func (s *Svc) Stop(svc service.Service) error {
	if s.cancel != nil {
		s.cancel()
	}
	if s.parado != nil {
		select {
		case <-s.parado:
		case <-time.After(tempoLimiteEncerramento):
			if s.logger != nil {
				s.logger.Printf("[AVISO] Tempo esgotado (%s) esperando o loop principal encerrar; seguindo mesmo assim.", tempoLimiteEncerramento)
			}
		}
	}
	return nil
}

// GetPortalURL gera a URL de acesso ao portal já autenticada para esta máquina específica.
// PreloadMachineToken lê a identidade da máquina já persistida em disco (sem
// gerar uma nova, sem fazer heartbeat) — usado quando este processo é uma
// bandeja interativa rodando ao lado do serviço, que já é quem manda
// heartbeat de verdade (ver main.go). Sem isso, GetPortalURL/GetTicketURL
// ficariam vazios para sempre nesta instância: token só é escrito em
// s.machineToken dentro de tick(), que aqui nunca roda.
func (s *Svc) PreloadMachineToken() error {
	t, err := token.LoadToken()
	if err != nil {
		return err
	}
	s.setMachineToken(t)
	return nil
}

func (s *Svc) GetPortalURL() string {
	tok := strings.TrimSpace(s.getMachineToken())
	if tok == "" {
		return ""
	}
	apiURL := strings.TrimRight(s.cfg.APIURL, "/")
	// Usamos o redirecionador de login automático para que o usuário não precise digitar senha.
	u := fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, url.QueryEscape(tok))
	return anexarUsuarioAtual(u)
}

// GetTicketURL gera a URL que leva direto à página de abertura de chamado,
// já autenticada. Construída em cima de GetPortalURL (não duplicando a
// montagem) por dois motivos: a URL de ticket sempre estende a de portal
// (mesmo token, mesmo requester_user — contrato coberto por
// TestPortalETicketCompartilhamMesmoEndpointETokens), e a resolução do
// usuário Windows/AD ativo (anexarUsuarioAtual, uma chamada WTS) roda uma
// única vez por clique, não duas.
func (s *Svc) GetTicketURL() string {
	portal := s.GetPortalURL()
	if portal == "" {
		return ""
	}
	return portal + "&redirect_to=/novo-ticket"
}

// anexarUsuarioAtual acrescenta requester_user=<usuário Windows/AD da sessão
// ativa AGORA> à URL de login por máquina — resolvido na hora do clique
// (collector.ResolverUsuarioAtual), não o valor de machines.current_user do
// último heartbeat, que pode estar até um ciclo inteiro (30-60s) desatualizado
// se a máquina tiver trocado de usuário nesse meio-tempo.
//
// Só afeta o TEXTO de exibição do requisitante no chamado (ver
// nomeRequisitante em handler/auth_handlers.go) — não é usado como
// identidade de autenticação nem de autorização; a sessão continua sendo a
// do usuário-fantasma da máquina, por token. Best-effort: se a resolução
// falhar (ex: sem sessão de console ativa), a URL sai sem o parâmetro e o
// backend cai de volta pro current_user já salvo em machines.
func anexarUsuarioAtual(u string) string {
	return anexarUsuarioAtualVia(u, collector.ResolverUsuarioAtual)
}

// anexarUsuarioAtualVia é a lógica de verdade, com o resolvedor injetado —
// separada só pra ser testável sem depender de uma sessão WTS real (mesma
// limitação de testabilidade já documentada em device_type_windows_test.go).
func anexarUsuarioAtualVia(u string, resolver func() string) string {
	usuarioAtual := strings.TrimSpace(resolver())
	if usuarioAtual == "" {
		return u
	}
	return u + "&requester_user=" + url.QueryEscape(usuarioAtual)
}

// run é o loop principal do agente: coleta dados → envia para o servidor → aguarda o próximo intervalo.
func (s *Svc) run(ctx context.Context) {
	s.logger.Println("🚀 Orion Agent iniciado com sucesso")
	s.startMetricsServer(ctx)

	// Jitter inicial no boot (0 a 3s) para desincronizar agentes ligando juntos
	if initJitter, err := rand.Int(rand.Reader, big.NewInt(3000)); err == nil {
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(initJitter.Int64()) * time.Millisecond):
		}
	}

	s.tick() // Fazemos a primeira coleta imediatamente ao subir

	baseInterval := time.Duration(s.cfg.IntervalSeconds) * time.Second
	if baseInterval <= 0 {
		baseInterval = 60 * time.Second
	}

	heartbeatTicker := time.NewTicker(jitterDuration(baseInterval, 10))
	defer heartbeatTicker.Stop()

	// Verificamos se existem comandos remotos para executar a cada 30 segundos (com jitter).
	commandTicker := time.NewTicker(jitterDuration(30*time.Second, 10))
	defer commandTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Println("🛑 Encerrando Orion Agent...")
			return
		case <-heartbeatTicker.C:
			s.tick() // Ciclo normal de reporte de hardware/status
			heartbeatTicker.Reset(jitterDuration(baseInterval, 10))
		case <-commandTicker.C:
			s.pollAndExecuteCommands() // Ciclo de verificação de comandos (RMM)
			commandTicker.Reset(jitterDuration(30*time.Second, 10))
		}
	}
}

// tick executa uma rodada de coleta de dados e envio de heartbeat.
func (s *Svc) tick() {
	payload, err := collector.Collect()
	if err != nil {
		s.logger.Printf("[ERRO] Falha ao coletar dados de hardware: %v", err)
		return
	}
	payload.AgentVersion = version.Version

	if payload.IdentityFallbackReason != "" {
		s.logger.Printf("[AVISO] Identidade do usuário resolvida via variáveis de ambiente, não WTS: %s", payload.IdentityFallbackReason)
	}

	// Gerenciamento de Identidade (Token)
	// Se for o primeiro acesso, carregamos do disco ou geramos uma nova identidade
	// aleatória (token.GenerateRandomIdentity — ver MACHINE-IDENTITY-OPTIONS.md).
	//
	// A checagem e a escrita aqui não precisam de sincronização ENTRE SI: tick()
	// só roda nesta goroutine (o select de run()), nunca em paralelo consigo
	// mesma. O mutex em setMachineToken/getMachineToken protege contra os
	// LEITORES externos (GetPortalURL/GetTicketURL, na goroutine da bandeja).
	if s.getMachineToken() == "" {
		t, err := token.LoadToken()
		if err != nil {
			// Máquina nunca registrada nesta instalação — antes de gerar
			// identidade e registrar de verdade, checa se este processo está
			// rodando dentro de uma VM de análise dinâmica (sandbox
			// multi-engine tipo VirusTotal). Essas ferramentas executam o
			// .exe de verdade numa VM descartável pra observar comportamento;
			// sem esta checagem, cada análise futura (VT redistribui a
			// amostra pra dezenas de parceiros) registraria mais uma máquina
			// fantasma no painel. Só roda nesta ramificação porque uma
			// máquina já registrada e aprovada não deve mais ser
			// reavaliada — protege contra falso positivo em VM legítima já
			// em produção (Hyper-V/ESXi real), que passou pelo gate manual
			// no primeiro registro.
			if collector.DetectarAmbienteDeSandbox() {
				s.logger.Println("[INFO] Ambiente de VM de análise detectado (VirtualBox/VMware/QEMU/Xen) — pulando registro nesta execução.")
				return
			}
			s.logger.Printf("[INFO] Identidade local não encontrada, gerando nova identidade de máquina.")
			t, err = token.GenerateRandomIdentity()
			if err != nil {
				s.logger.Printf("[ERRO] Falha ao gerar identidade da máquina: %v", err)
				return
			}
			if err := token.SaveToken(t); err != nil {
				// Não seguimos com uma identidade gerada mas não persistida: se o
				// processo reiniciar antes de uma gravação bem-sucedida, uma NOVA
				// identidade aleatória seria gerada no próximo start, registrando
				// uma segunda máquina no backend para o mesmo computador físico.
				// Preferimos pular o check-in deste ciclo e tentar de novo no
				// próximo — LoadToken continuará falhando até SaveToken funcionar.
				s.logger.Printf("[ERRO] Falha ao salvar identidade local, tentando novamente no próximo ciclo: %v", err)
				return
			}
		}
		s.setMachineToken(t)
	}
	machineToken := s.getMachineToken()
	payload.MachineToken = machineToken

	// Alimenta o cache do endpoint /metrics (ver lastPayload) com este mesmo
	// snapshot — inclusive já com MachineToken e AgentVersion preenchidos,
	// então NewMetricsHandler não precisa repetir essa montagem.
	s.setLastPayload(payload)

	// Garantimos que o atalho de "Abrir Portal" esteja sempre presente no Desktop do usuário.
	if err := shortcut.CreatePortalShortcut(s.cfg.APIURL, machineToken); err != nil {
		s.logger.Printf("[AVISO] Não foi possível atualizar o atalho no Desktop: %v", err)
	}

	// Enviamos o relatório para o servidor.
	mID, err := sender.Send(s.cfg, payload)
	if err != nil {
		s.logger.Printf("[ERRO] Falha no check-in (Heartbeat): %v", err)
		return
	}
	s.setMachineID(mID)

	// Log amigável do status atual da coleta.
	s.logger.Printf("[OK] Check-in realizado — %s (%s) | CPU: %.1f%% | RAM: %dMB/%dMB",
		payload.Hostname,
		payload.IP,
		payload.CPUUsage,
		payload.RAMUsed/1024/1024,
		payload.RAMTotal/1024/1024,
	)
}

// pollAndExecuteCommands busca e executa comandos pendentes enviados pelo painel de controle.
func (s *Svc) pollAndExecuteCommands() {
	machineID := s.getMachineID()
	if machineID == "" {
		return
	}

	cmds, err := sender.PollCommands(s.cfg, machineID)
	if err != nil {
		s.logger.Printf("[ERRO] Falha ao buscar comandos remotos: %v", err)
		return
	}

	for _, c := range cmds {
		// Log só do ID, não do texto do comando (correção A.11): um técnico pode
		// enviar um comando com um segredo embutido (ex.: credencial numa linha
		// "net use"), e o texto completo entrando em agent.log duplicava essa
		// exposição — o conteúdo já fica registrado no backend, sob controle de
		// acesso por role, via RespondToCommand logo abaixo.
		s.logger.Printf("[RMM] Executando comando remoto (id=%s)", c.ID)
		
		cmdTrimmed := strings.TrimSpace(c.Command)
		if strings.HasPrefix(cmdTrimmed, "orion-install") {
			go s.handleOrionInstall(c.ID, cmdTrimmed)
			continue
		}

		if strings.HasPrefix(cmdTrimmed, "orion-start-terminal") {
			go s.StartRemoteTerminalSession()
			sender.RespondToCommand(s.cfg, c.ID, "completed", "Terminal session started")
			continue
		}

		output, err := executeCommand(c.Command)
		status := "completed"
		if err != nil {
			status = "failed"
			output = fmt.Sprintf("Erro na execução: %v\nSaída: %s", err, output)
		}

		// Reportamos o resultado do comando de volta para o portal.
		if err := sender.RespondToCommand(s.cfg, c.ID, status, output); err != nil {
			s.logger.Printf("[ERRO] Falha ao enviar resposta do comando: %v", err)
		}
	}
}

// tempoLimiteComando é o prazo máximo de execução de um comando remoto.
//
// Sem prazo, um único comando que não retorna (processo interativo esperando entrada,
// acesso a share de rede fora do ar, loop infinito) congelava o loop principal do
// agente para sempre: o heartbeat parava, o polling parava e a única saída era
// reiniciar o serviço manualmente na máquina.
const tempoLimiteComando = 5 * time.Minute

// executeCommand roda um comando via CMD do Windows e captura a saída.
func executeCommand(command string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), tempoLimiteComando)
	defer cancel()

	cmd := exec.CommandContext(ctx, "cmd", "/C", command)
	// Sem isso, o Windows abre e fecha rapidinho uma janela de console
	// visível toda vez que um comando remoto roda — o agente é um
	// serviço em segundo plano, sem console próprio, então cmd.exe
	// herda o comportamento padrão de abrir uma janela nova. Mesmo
	// padrão já usado em notify_windows.go.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return string(out), fmt.Errorf("comando excedeu o tempo limite de %s e foi encerrado", tempoLimiteComando)
	}
	return string(out), err
}

// ServiceConfig define as propriedades de exibição do serviço no Windows.
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e permite suporte remoto proativo via Orion System.",

		// Correção A.4: antes, UserName vazio fazia o Windows instalar o
		// serviço como LocalSystem (kardianos/service, ServiceStartName=""),
		// o nível de privilégio mais alto possível numa máquina Windows —
		// desproporcional para um agente que só coleta métricas e executa
		// comandos remotos. "NT SERVICE\OrionAgent" é uma conta de serviço
		// VIRTUAL: o Windows a cria e gerencia automaticamente para qualquer
		// serviço cujo Name bata (OrionAgent, acima) — não precisa de senha
		// nem de registro prévio. Ela começa com privilégios mínimos, só o
		// necessário para operação básica de serviço.
		//
		// IMPORTANTE, não verificado nesta sessão: esta mudança precisa ser
		// validada numa instalação real antes de ir para produção — se
		// alguma operação do agente hoje depender implicitamente de
		// privilégio de SYSTEM (ex.: alguma chamada específica do gopsutil
		// em determinada versão do Windows), a conta virtual pode não ter
		// permissão suficiente e a coleta falhar silenciosamente. Testar
		// especialmente: leitura de contadores de performance/WMI, e a
		// migração de instalações já existentes (ver comentário em
		// token/token.go:saveTokenTo sobre a ACL do diretório de identidade,
		// já ajustada para acompanhar essa troca).
		UserName: `NT SERVICE\OrionAgent`,
	}
}

func (s *Svc) handleOrionInstall(commandID string, commandText string) {
	s.logger.Printf("[ORION-INSTALL] Iniciando instalação para comando %s", commandID)
	
	// Notifica o usuário na área de trabalho que uma atualização automática está em andamento
	ShowUpdateNotification("Orion System", "Baixando e instalando nova atualização do Orion Agent em segundo plano...")

	url, hash, silentArgs, err := parseOrionInstallArgs(commandText)
	if err != nil {
		msg := fmt.Sprintf("Erro ao fazer parse dos argumentos: %v", err)
		sender.RespondToCommand(s.cfg, commandID, "failed", msg)
		return
	}

	tempFile, err := downloadFileToTemp(url)
	if err != nil {
		msg := fmt.Sprintf("Erro no download: %v", err)
		sender.RespondToCommand(s.cfg, commandID, "failed", msg)
		return
	}
	defer os.Remove(tempFile) // Limpa o arquivo temporário depois

	// Hash é obrigatório: sem ele, um instalador baixado por HTTP simples ou
	// de um host comprometido rodaria sem nenhuma verificação de integridade.
	if hash == "" {
		msg := "Comando rejeitado: --hash é obrigatório para orion-install"
		sender.RespondToCommand(s.cfg, commandID, "failed", msg)
		return
	}
	if err := verifySHA256(tempFile, hash); err != nil {
		msg := fmt.Sprintf("Erro na verificação de hash: %v", err)
		sender.RespondToCommand(s.cfg, commandID, "failed", msg)
		return
	}

	output, err := runInstaller(tempFile, silentArgs)
	if err != nil {
		msg := fmt.Sprintf("Erro na instalação: %v\nSaída: %s", err, output)
		sender.RespondToCommand(s.cfg, commandID, "failed", msg)
		return
	}

	msg := fmt.Sprintf("Instalação concluída com sucesso.\nSaída:\n%s", output)
	sender.RespondToCommand(s.cfg, commandID, "completed", msg)

	// Notifica que a atualização foi concluída com sucesso
	ShowUpdateNotification("Orion System", "Orion Agent atualizado com sucesso!")
}

func parseOrionInstallArgs(command string) (string, string, string, error) {
	// Exemplo: orion-install --url="https://..." --hash="12345" --args="/S /Q"
	urlRegex := regexp.MustCompile(`--url="([^"]+)"|--url=([^\s]+)`)
	hashRegex := regexp.MustCompile(`--hash="([^"]+)"|--hash=([^\s]+)`)
	argsRegex := regexp.MustCompile(`--args="([^"]+)"`)

	var url, hash, args string

	urlMatches := urlRegex.FindStringSubmatch(command)
	if len(urlMatches) > 0 {
		if urlMatches[1] != "" {
			url = urlMatches[1]
		} else {
			url = urlMatches[2]
		}
	}

	hashMatches := hashRegex.FindStringSubmatch(command)
	if len(hashMatches) > 0 {
		if hashMatches[1] != "" {
			hash = hashMatches[1]
		} else {
			hash = hashMatches[2]
		}
	}

	argsMatches := argsRegex.FindStringSubmatch(command)
	if len(argsMatches) > 1 {
		args = argsMatches[1]
	}

	if url == "" {
		return "", "", "", fmt.Errorf("URL não especificada")
	}

	return url, hash, args, nil
}

// extensaoDaURL extrai só a extensão do CAMINHO da URL, ignorando query
// string e fragmento.
//
// filepath.Base/Ext direto na URL crua quebra com as signed URLs do Supabase
// Storage (".../<hash>.exe?token=eyJ..."): o nome de arquivo saía com a query
// inteira grudada, "?" é caractere inválido no Windows e todo os.Create
// falhava ("open ...exe?token=eyJ...: The filename, directory name, or volume
// label syntax is incorrect"), derrubando 100% das auto-atualizações. Mesmo
// que o arquivo pudesse ser criado, filepath.Ext devolveria ".exe?token=..."
// e runInstaller cairia no default "extensão não suportada".
func extensaoDaURL(bruta string) string {
	if u, err := url.Parse(bruta); err == nil && u.Path != "" {
		return strings.ToLower(path.Ext(u.Path))
	}
	return ""
}

func downloadFileToTemp(rawURL string) (string, error) {
	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(rawURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status HTTP inválido: %s", resp.Status)
	}

	// A extensão precisa sobreviver — runInstaller decide como executar
	// (msiexec/powershell/cmd/direto) a partir dela. O resto do nome não
	// importa, então CreateTemp resolve unicidade e caracteres inválidos de
	// uma vez só.
	ext := extensaoDaURL(rawURL)
	if ext == "" {
		ext = ".exe"
	}

	out, err := os.CreateTemp("", "orion-update-*"+ext)
	if err != nil {
		return "", err
	}
	tempFilePath := out.Name()
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	return tempFilePath, nil
}

func verifySHA256(filePath, expectedHash string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}

	calculatedHash := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(calculatedHash, expectedHash) {
		return fmt.Errorf("hash SHA-256 não confere (esperado: %s, obtido: %s)", expectedHash, calculatedHash)
	}

	return nil
}

func runInstaller(filePath, silentArgs string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	var cmd *exec.Cmd

	argsList := strings.Fields(silentArgs)

	switch ext {
	case ".msi":
		baseArgs := []string{"/i", filePath}
		baseArgs = append(baseArgs, argsList...)
		cmd = exec.Command("msiexec", baseArgs...)
	case ".exe":
		cmd = exec.Command(filePath, argsList...)
	case ".ps1":
		baseArgs := []string{"-ExecutionPolicy", "Bypass", "-File", filePath}
		baseArgs = append(baseArgs, argsList...)
		cmd = exec.Command("powershell", baseArgs...)
	case ".bat":
		baseArgs := []string{"/c", filePath}
		baseArgs = append(baseArgs, argsList...)
		cmd = exec.Command("cmd", baseArgs...)
	default:
		return "", fmt.Errorf("extensão de arquivo não suportada: %s", ext)
	}

	// Mesmo motivo do executeCommand acima: sem HideWindow, msiexec/
	// powershell/cmd/o instalador baixado abrem uma janela de console
	// visível (mesmo rodando dentro do serviço, sem sessão interativa).
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (s *Svc) executeSelfHealingRemediation(alertType string, action string, payload string) {
	s.logger.Printf("[SELF-HEAL] Executing remediation for alert %s: %s", alertType, action)
	
	var output string
	var err error
	
	if action == "restart_service" {
		cleanService := strings.TrimSpace(payload)
		if !regexp.MustCompile(`^[a-zA-Z0-9_\-\. ]+$`).MatchString(cleanService) {
			output = "Nome de serviço inválido para reinicialização"
			err = fmt.Errorf("nome de serviço inválido")
		} else {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()
			stopCmd := exec.CommandContext(ctx, "net", "stop", cleanService)
			stopCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
			_ = stopCmd.Run()

			startCmd := exec.CommandContext(ctx, "net", "start", cleanService)
			startCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
			out, startErr := startCmd.CombinedOutput()
			output = string(out)
			err = startErr
		}
	} else if action == "run_script" {
		output, err = executeCommand(payload)
	} else {
		output = "Ação de remediação desconhecida"
		err = fmt.Errorf("ação desconhecida")
	}
	
	status := "success"
	if err != nil {
		status = "failed"
		output = fmt.Sprintf("Erro: %v\nOutput: %s", err, output)
	}
	
	s.reportSelfHealingEvent(alertType, status, output)
}

func (s *Svc) reportSelfHealingEvent(alertType, status, output string) {
	machineID := s.getMachineID()
	if machineID == "" {
		return
	}
	
	endpoint := fmt.Sprintf("%s/api/monitoring/self-heal-event", s.cfg.APIURL)
	
	payload := map[string]string{
		"machine_id": machineID,
		"alert_type": alertType,
		"status":     status,
		"output":     output,
	}
	
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(body))
	if err == nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Agent-Key", s.cfg.AgentKey)
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}
}

// NewMetricsHandler constrói o roteador HTTP para o endpoint de métricas Prometheus (/metrics) e healthcheck (/health).
func NewMetricsHandler(s *Svc) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		// Serve o snapshot já coletado pelo ciclo normal do heartbeat
		// (s.lastPayload, atualizado em tick()) em vez de rodar
		// collector.Collect() do zero a cada scrape do Prometheus — essa
		// coleta já inclui os módulos caros de Security/RemoteSoftware
		// (com seu próprio cache por TTL, ver expensive_cache.go), então
		// repeti-la aqui só duplicava o custo sem ganhar atualidade real:
		// o scrape (15s) é mais frequente que o heartbeat (30s por
		// padrão), então o snapshot nunca fica "velho" o suficiente para
		// justificar recoletar.
		var payload *collector.Payload
		if s != nil {
			payload = s.getLastPayload()
		}
		if payload == nil {
			// Só acontece em janelas raras: processo acabou de subir e o
			// primeiro tick() ainda não completou. Coleta avulsa aqui é o
			// preço aceitável de não deixar o primeiro scrape vazio.
			p, err := collector.GetHardwareInfo()
			if err != nil {
				if s != nil && s.logger != nil {
					s.logger.Printf("[METRICS] Erro ao coletar métricas de hardware: %v", err)
				}
				http.Error(w, fmt.Sprintf("Erro ao coletar métricas: %v", err), http.StatusInternalServerError)
				return
			}
			if s != nil {
				if tok := s.getMachineToken(); tok != "" {
					p.MachineToken = tok
				}
			}
			p.AgentVersion = version.Version
			payload = p
		}

		metricsText := collector.GeneratePrometheusMetrics(payload)

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(metricsText))
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	return mux
}

// startMetricsServer inicia o servidor HTTP leve para expor métricas Prometheus na porta configurada.
func (s *Svc) startMetricsServer(ctx context.Context) {
	if s.cfg == nil || !s.cfg.IsMetricsEnabled() {
		if s.logger != nil {
			s.logger.Println("[METRICS] Servidor de métricas Prometheus desabilitado por configuração.")
		}
		return
	}

	port := s.cfg.MetricsPort
	if port <= 0 {
		port = 9182
	}

	addr := fmt.Sprintf(":%d", port)
	server := &http.Server{
		Addr:    addr,
		Handler: NewMetricsHandler(s),
	}

	go func() {
		if s.logger != nil {
			s.logger.Printf("📊 Servidor de métricas Prometheus ativo em http://0.0.0.0:%d/metrics", port)
		}
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			if s.logger != nil {
				s.logger.Printf("[METRICS] Erro no servidor HTTP de métricas: %v", err)
			}
		}
	}()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			if s.logger != nil {
				s.logger.Printf("[METRICS] Erro ao encerrar servidor de métricas: %v", err)
			}
		}
	}()
}

