package main

import (
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"path/filepath"

	"github.com/kardianos/service"

	"orion-agent/config"
	agentsvc "orion-agent/service"
	"orion-agent/tray"
)

func main() {
	// ── Configuração de Logs ──────────────────────────────────
	// Tentamos abrir o arquivo de log para registrar as atividades do agente.
	logger, logFile, err := setupLogger()
	if err != nil {
		// Caso não consiga criar o arquivo (permissão, etc), usamos a saída de erro padrão.
		log.Printf("[AVISO] Não foi possível abrir o arquivo de log: %v", err)
		logger = log.New(os.Stderr, "", log.LstdFlags)
	}
	if logFile != nil {
		defer logFile.Close()
	}

	// ── Carregamento de Configurações ──────────────────────────
	// O arquivo config.json guarda a URL do backend e o intervalo de check-in.
	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("[ERRO] Falha crítica ao carregar configurações: %v", err)
	}

	// ── Preparação do Serviço Windows ──────────────────────────
	// Aqui definimos como o Windows deve tratar esse executável como um serviço.
	svcConfig := agentsvc.ServiceConfig()
	svc := agentsvc.New(cfg, logger)

	s, err := service.New(svc, svcConfig)
	if err != nil {
		logger.Fatalf("[ERRO] Falha ao registrar a estrutura de serviço: %v", err)
	}

	// ── Processamento de Comandos de Linha de Comando ──────────
	// Suportamos 'install' e 'uninstall' para facilitar a vida do técnico.
	arg := ""
	if len(os.Args) > 1 {
		arg = os.Args[1]
	}

	switch arg {
	case "install":
		if err := s.Install(); err != nil {
			logger.Fatalf("[ERRO] Não foi possível instalar o serviço: %v", err)
		}
		fmt.Println("✅ Serviço OrionAgent instalado com sucesso!")
		fmt.Println("🚀 Inicie com: sc start OrionAgent (ou pelo Gerenciador de Serviços)")

	case "uninstall":
		if err := s.Uninstall(); err != nil {
			logger.Fatalf("[ERRO] Não foi possível remover o serviço: %v", err)
		}
		fmt.Println("🗑️ Serviço OrionAgent removido com sucesso.")

	default:
		// Se não houver argumentos, estamos rodando o agente "de verdade".
		if !service.Interactive() {
			// Execução silenciosa como serviço do Windows.
			if err := s.Run(); err != nil {
				logger.Fatalf("[ERRO] Falha na execução do serviço: %v", err)
			}
			return
		}

		// Se estivermos em modo interativo (ex: clicado pelo usuário), iniciamos a Tray.
		// Rodamos a lógica do agente em background (goroutine) para não travar o menu.
		go func() {
			logger.Printf("Iniciando monitoramento em background — Servidor: %s", cfg.APIURL)
			if err := s.Run(); err != nil {
				logger.Printf("[ERRO] Falha na execução de background: %v", err)
			}
		}()

		// Gerenciador da bandeja do sistema (perto do relógio).
		// Este bloco é bloqueante e mantém o processo vivo.
		//
		// t é declarado antes para que os callbacks possam atualizar o status da
		// bandeja. Eles só executam depois de t.Run(), quando t já está atribuído.
		var t *tray.TrayManager

		// abrir centraliza o tratamento dos dois itens de menu que levam ao portal.
		// Quando a URL está vazia (o agente ainda não concluiu o primeiro check-in),
		// o clique antes não fazia absolutamente nada — sem erro, sem aviso, sem log
		// visível ao usuário. Agora o motivo aparece na própria bandeja.
		abrir := func(destino string, montarURL func() string) {
			url := montarURL()
			if url == "" {
				logger.Printf("[TRAY] %s indisponível: aguardando o primeiro check-in com o servidor.", destino)
				t.SetStatus("aguardando primeiro check-in…")
				return
			}
			tray.OpenURL(url)
			// A URL carrega o machine_token na query string; logá-la inteira gravava
			// uma credencial de longa duração em texto plano no agent.log a cada clique.
			logger.Printf("[TRAY] Abrindo %s: %s", destino, redigirQuery(url))
			t.SetStatus("conectado")
		}

		t = tray.New(
			func() {
				// Ação de "Abrir Portal" detecta o token e abre no navegador.
				abrir("portal de suporte", svc.GetPortalURL)
			},
			func() {
				// Ação de "Abrir Chamado" leva direto à criação de ticket.
				abrir("página de novo chamado", svc.GetTicketURL)
			},
			func() {
				// Comando de saída finaliza o agente completamente.
				logger.Println("[TRAY] Encerrando o agente Orion por solicitação do usuário.")
				os.Exit(0)
			},
		)
		t.Run()
	}
}

// redigirQuery remove a query string de uma URL antes de registrá-la em log.
//
// As URLs do portal carregam o machine_token — credencial que concede sessão
// autenticada sem senha — como parâmetro. Sem esta redação, cada clique na bandeja
// gravava essa credencial em texto plano no agent.log, que fica na pasta do
// executável e herda a ACL do diretório (legível por usuários comuns).
func redigirQuery(bruta string) string {
	u, err := url.Parse(bruta)
	if err != nil {
		return "[url inválida]"
	}
	if u.RawQuery == "" {
		return u.String()
	}
	u.RawQuery = "[redigido]"
	return u.String()
}

// setupLogger configura a escrita de logs para um arquivo local (agent.log) na mesma pasta do executável.
// Isso ajuda muito no troubleshooting quando o agente está rodando como SYSTEM.
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

	// Escrevemos simultaneamente no arquivo e no console (se houver um aberto).
	w := io.MultiWriter(f, os.Stderr)
	logger := log.New(w, "", log.LstdFlags)
	return logger, f, nil
}
