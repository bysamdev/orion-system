package service

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"sync"
	"time"

	"github.com/kardianos/service"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
	"orion-agent/shortcut"
	"orion-agent/token"
	"orion-agent/version"
)

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
func (s *Svc) GetPortalURL() string {
	token := s.getMachineToken()
	if token == "" {
		return ""
	}
	// Usamos o redirecionador de login automático para que o usuário não precise digitar senha.
	return fmt.Sprintf("%s/api/auth/machine-login?token=%s", s.cfg.APIURL, token)
}

// GetTicketURL gera a URL que leva direto à página de abertura de chamado, já autenticada.
func (s *Svc) GetTicketURL() string {
	token := s.getMachineToken()
	if token == "" {
		return ""
	}
	return fmt.Sprintf("%s/api/auth/machine-login?token=%s&redirect_to=/novo-ticket", s.cfg.APIURL, token)
}

// run é o loop principal do agente: coleta dados → envia para o servidor → aguarda o próximo intervalo.
func (s *Svc) run(ctx context.Context) {
	s.logger.Println("🚀 Orion Agent iniciado com sucesso")
	s.tick() // Fazemos a primeira coleta imediatamente ao subir

	ticker := time.NewTicker(time.Duration(s.cfg.IntervalSeconds) * time.Second)
	defer ticker.Stop()

	// Verificamos se existem comandos remotos para executar a cada 30 segundos.
	commandTicker := time.NewTicker(30 * time.Second)
	defer commandTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Println("🛑 Encerrando Orion Agent...")
			return
		case <-ticker.C:
			s.tick() // Ciclo normal de reporte de hardware/status
		case <-commandTicker.C:
			s.pollAndExecuteCommands() // Ciclo de verificação de comandos (RMM)
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
