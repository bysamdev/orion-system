package service

import (
	"context"
	"log"
	"time"

	"github.com/kardianos/service"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
)

// Svc implements service.Interface for kardianos/service.
type Svc struct {
	cfg    *config.Config
	logger *log.Logger
	cancel context.CancelFunc
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

	for {
		select {
		case <-ctx.Done():
			s.logger.Println("orion-agent encerrado")
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *Svc) tick() {
	payload, err := collector.Collect()
	if err != nil {
		s.logger.Printf("[ERRO] coleta de hardware: %v", err)
		return
	}

	if err := sender.Send(s.cfg, payload); err != nil {
		s.logger.Printf("[ERRO] heartbeat: %v", err)
		return
	}

	s.logger.Printf("[OK] heartbeat enviado — %s (%s) CPU=%.1f%% RAM=%dMB/%dMB",
		payload.Hostname,
		payload.IP,
		payload.CPUUsage,
		payload.RAMUsed/1024/1024,
		payload.RAMTotal/1024/1024,
	)
}

// ServiceConfig returns the kardianos service.Config.
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e envia ao Orion System.",
	}
}
