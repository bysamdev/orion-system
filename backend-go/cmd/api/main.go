package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion-system-backend/internal/app"
	"orion-system-backend/internal/config"
)

func main() {
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config inválida: %v", err)
	}

	a, err := app.New(cfg)
	if err != nil {
		log.Fatalf("falha ao inicializar app: %v", err)
	}
	defer a.Close()

	// Contexto cancelado no shutdown para parar o cron de monitoramento
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Inicia cron de monitoramento (marca máquinas offline a cada minuto)
	a.StartMonitoringCron(ctx)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           a.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("API Go ouvindo em %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("erro http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	cancel() // para o cron antes do shutdown HTTP

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()

	_ = srv.Shutdown(shutCtx)
}


