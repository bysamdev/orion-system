package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"time"

	"github.com/kardianos/service"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
	"orion-agent/shortcut"
	"orion-agent/token"
)

// Svc implements service.Interface for kardianos/service.
type Svc struct {
	cfg          *config.Config
	logger       *log.Logger
	cancel       context.CancelFunc
	machineID    string
	machineToken string
}

// New creates a new Svc.
func New(cfg *config.Config, logger *log.Logger) *Svc {
	return &Svc{cfg: cfg, logger: logger}
}

// Start is called when the service starts (by the OS service manager).
func (s *Svc) Start(svc service.Service) error {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.run(ctx)
	go s.StartLocalServer(ctx)
	return nil
}

// Stop is called when the service is stopped.
func (s *Svc) Stop(svc service.Service) error {
	if s.cancel != nil {
		s.cancel()
	}
	return nil
}

// run is the main loop: collect → send, every cfg.IntervalSeconds.
func (s *Svc) run(ctx context.Context) {
	s.logger.Println("orion-agent iniciado")
	s.tick() // first tick immediately

	ticker := time.NewTicker(time.Duration(s.cfg.IntervalSeconds) * time.Second)
	defer ticker.Stop()

	commandTicker := time.NewTicker(30 * time.Second) // Poll commands every 30s
	defer commandTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Println("orion-agent encerrado")
			return
		case <-ticker.C:
			s.tick()
		case <-commandTicker.C:
			s.pollAndExecuteCommands()
		}
	}
}

// StartLocalServer runs a minimal HTTP server to expose the token to the frontend.
func (s *Svc) StartLocalServer(ctx context.Context) {
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*") // Limit this to Orion URL in production
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"machine_token": s.machineToken,
			"status":        "online",
		})
	})

	server := &http.Server{
		Addr:    "127.0.0.1:8081",
		Handler: mux,
	}

	go func() {
		s.logger.Println("Local server listening on 127.0.0.1:8081")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Printf("[ERRO] local server: %v", err)
		}
	}()

	<-ctx.Done()
	server.Shutdown(context.Background())
}

func (s *Svc) tick() {
	payload, err := collector.Collect()
	if err != nil {
		s.logger.Printf("[ERRO] coleta de hardware: %v", err)
		return
	}

	// Token management
	if s.machineToken == "" {
		t, err := token.LoadToken()
		if err != nil {
			s.logger.Printf("[DEBUG] token não encontrado localmente, gerando novo: %v", err)
			t = payload.GenerateToken()
			if err := token.SaveToken(t); err != nil {
				s.logger.Printf("[ERRO] salvar token: %v", err)
			}
		}
		s.machineToken = t
	}
	payload.MachineToken = s.machineToken
	
	// Garantir atalho no desktop
	if err := shortcut.CreatePortalShortcut(s.cfg.APIURL, s.machineToken); err != nil {
		s.logger.Printf("[AVISO] não foi possível criar atalho: %v", err)
	}

	mID, err := sender.Send(s.cfg, payload)
	if err != nil {
		s.logger.Printf("[ERRO] heartbeat: %v", err)
		return
	}
	s.machineID = mID

	s.logger.Printf("[OK] heartbeat enviado — %s (%s) ID=%s CPU=%.1f%% RAM=%dMB/%dMB",
		payload.Hostname,
		payload.IP,
		s.machineID,
		payload.CPUUsage,
		payload.RAMUsed/1024/1024,
		payload.RAMTotal/1024/1024,
	)
}

func (s *Svc) pollAndExecuteCommands() {
	if s.machineID == "" {
		return
	}

	cmds, err := sender.PollCommands(s.cfg, s.machineID)
	if err != nil {
		s.logger.Printf("[ERRO] poll de comandos: %v", err)
		return
	}

	for _, c := range cmds {
		s.logger.Printf("[CMD] Executando: %s", c.Command)
		output, err := executeCommand(c.Command)
		status := "completed"
		if err != nil {
			status = "failed"
			output = fmt.Sprintf("Erro: %v\nOutput: %s", err, output)
		}

		if err := sender.RespondToCommand(s.cfg, c.ID, status, output); err != nil {
			s.logger.Printf("[ERRO] resposta de comando: %v", err)
		}
	}
}

func executeCommand(command string) (string, error) {
	cmd := exec.Command("cmd", "/C", command)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// ServiceConfig returns the kardianos service.Config.
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e envia ao Orion System.",
	}
}
