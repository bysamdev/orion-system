package service

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"time"

	"github.com/kardianos/service"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
	"orion-agent/shortcut"
	"orion-agent/token"
)

// Svc implementa a interface service.Interface necessária para rodar como serviço Windows.
type Svc struct {
	cfg          *config.Config
	logger       *log.Logger
	cancel       context.CancelFunc
	machineID    string
	machineToken string
}

// New cria uma nova instância do serviço com as dependências necessárias.
func New(cfg *config.Config, logger *log.Logger) *Svc {
	return &Svc{cfg: cfg, logger: logger}
}

// Start é chamado pelo Windows quando o serviço é iniciado.
func (s *Svc) Start(svc service.Service) error {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.run(ctx) // A lógica real roda em uma goroutine separada
	return nil
}

// Stop é chamado pelo Windows quando o serviço é encerrado.
func (s *Svc) Stop(svc service.Service) error {
	if s.cancel != nil {
		s.cancel()
	}
	return nil
}

// GetPortalURL gera a URL de acesso ao portal já autenticada para esta máquina específica.
func (s *Svc) GetPortalURL() string {
	if s.machineToken == "" {
		return ""
	}
	// Usamos o redirecionador de login automático para que o usuário não precise digitar senha.
	return fmt.Sprintf("%s/api/auth/machine-login?token=%s", s.cfg.APIURL, s.machineToken)
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

	// Gerenciamento de Identidade (Token)
	// Se for o primeiro acesso, carregamos do disco ou geramos um novo.
	if s.machineToken == "" {
		t, err := token.LoadToken()
		if err != nil {
			s.logger.Printf("[INFO] Identidade local não encontrada, registrando máquina pela primeira vez.")
			t = payload.GenerateToken()
			if err := token.SaveToken(t); err != nil {
				s.logger.Printf("[ERRO] Falha ao salvar identidade local: %v", err)
			}
		}
		s.machineToken = t
	}
	payload.MachineToken = s.machineToken
	
	// Garantimos que o atalho de "Abrir Portal" esteja sempre presente no Desktop do usuário.
	if err := shortcut.CreatePortalShortcut(s.cfg.APIURL, s.machineToken); err != nil {
		s.logger.Printf("[AVISO] Não foi possível atualizar o atalho no Desktop: %v", err)
	}

	// Enviamos o relatório para o servidor.
	mID, err := sender.Send(s.cfg, payload)
	if err != nil {
		s.logger.Printf("[ERRO] Falha no check-in (Heartbeat): %v", err)
		return
	}
	s.machineID = mID

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
	if s.machineID == "" {
		return
	}

	cmds, err := sender.PollCommands(s.cfg, s.machineID)
	if err != nil {
		s.logger.Printf("[ERRO] Falha ao buscar comandos remotos: %v", err)
		return
	}

	for _, c := range cmds {
		s.logger.Printf("[RMM] Executando comando remoto: %s", c.Command)
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

// executeCommand roda um comando via CMD do Windows e captura a saída.
func executeCommand(command string) (string, error) {
	cmd := exec.Command("cmd", "/C", command)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// ServiceConfig define as propriedades de exibição do serviço no Windows.
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e permite suporte remoto proativo via Orion System.",
	}
}
