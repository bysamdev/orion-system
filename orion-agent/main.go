package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/kardianos/service"

	"orion-agent/config"
	agentsvc "orion-agent/service"
	"orion-agent/tray"
)

func main() {
	// ── Logger setup ──────────────────────────────────────────
	logger, logFile, err := setupLogger()
	if err != nil {
		// Can't write log — fall back to stderr
		log.Printf("[AVISO] Não foi possível abrir log file: %v", err)
		logger = log.New(os.Stderr, "", log.LstdFlags)
	}
	if logFile != nil {
		defer logFile.Close()
	}

	// ── Config ────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("[ERRO] config: %v", err)
	}

	// ── Service setup ─────────────────────────────────────────
	svcConfig := agentsvc.ServiceConfig()
	svc := agentsvc.New(cfg, logger)

	s, err := service.New(svc, svcConfig)
	if err != nil {
		logger.Fatalf("[ERRO] service.New: %v", err)
	}

	// ── Dispatch command ──────────────────────────────────────
	arg := ""
	if len(os.Args) > 1 {
		arg = os.Args[1]
	}

	switch arg {
	case "install":
		if err := s.Install(); err != nil {
			logger.Fatalf("[ERRO] install: %v", err)
		}
		fmt.Println("Serviço OrionAgent instalado com sucesso.")
		fmt.Println("Inicie com: sc start OrionAgent  (ou Services do Windows)")

	case "uninstall":
		if err := s.Uninstall(); err != nil {
			logger.Fatalf("[ERRO] uninstall: %v", err)
		}
		fmt.Println("Serviço OrionAgent removido com sucesso.")

	default:
		// Se não estiver rodando como serviço (interativo), iniciamos o Tray
		if !service.Interactive() {
			// Se rodar como serviço puro, apenas executa o logic
			if err := s.Run(); err != nil {
				logger.Fatalf("[ERRO] run service: %v", err)
			}
			return
		}

		// Roda o loop de monitoramento em uma goroutine
		go func() {
			logger.Printf("Iniciando background agent — backend: %s", cfg.APIURL)
			if err := s.Run(); err != nil {
				logger.Printf("[ERRO] background run: %v", err)
			}
		}()

		// Inicia o System Tray (bloqueia a thread principal)
		t := tray.New(
			func() {
				url := svc.GetPortalURL()
				if url != "" {
					tray.OpenURL(url)
					logger.Printf("[TRAY] Abrindo portal: %s", url)
				}
			},
			func() {
				logger.Println("[TRAY] Sair clicado. Encerrando...")
				os.Exit(0)
			},
		)
		t.Run()
	}
}

// setupLogger opens (or creates) agent.log in the executable directory.
// It returns a logger that writes to both the file and stderr.
func setupLogger() (*log.Logger, *os.File, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, nil, err
	}
	dir := filepath.Dir(exe)
	logPath := filepath.Join(dir, "agent.log")

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return nil, nil, err
	}

	w := io.MultiWriter(f, os.Stderr)
	logger := log.New(w, "", log.LstdFlags)
	return logger, f, nil
}
