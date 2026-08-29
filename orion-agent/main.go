package main

import (
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"

	"strings"
	"time"

	"github.com/kardianos/service"

	"orion-agent/addremove"
	"orion-agent/config"
	agentsvc "orion-agent/service"
	"orion-agent/shortcut"
	"orion-agent/startup"
	"orion-agent/tray"
)

func main() {
	// ── Carregamento de Configurações ──────────────────────────
	// Carregado ANTES do logger porque cfg.LogFile define o nome do arquivo de
	// log (correção B.15) — antes, log_file era parseado do agent.yaml mas
	// nunca usado: o logger sempre abria "agent.log" hardcoded, porque era
	// configurado antes de sabermos o que o config.Load() diria.
	cfg, err := config.Load()
	if err != nil {
		// Ainda não temos logger customizado aqui — reportamos no log padrão.
		log.Fatalf("[ERRO] Falha crítica ao carregar configurações: %v", err)
	}

	// ── Configuração de Logs ──────────────────────────────────
	// Tentamos abrir o arquivo de log para registrar as atividades do agente.
	logger, logFile, err := setupLogger(cfg.LogFile)
	if err != nil {
		// Caso não consiga criar o arquivo (permissão, etc), usamos a saída de erro padrão.
		log.Printf("[AVISO] Não foi possível abrir o arquivo de log: %v", err)
		logger = log.New(os.Stderr, "", log.LstdFlags)
	}
	if logFile != nil {
		defer logFile.Close()
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
		pararCmd := exec.Command("sc", "stop", "OrionAgent")
		esconderJanela(pararCmd)
		_ = pararCmd.Run()
		_ = s.Stop()
		_ = s.Uninstall()
		deletarCmd := exec.Command("sc", "delete", "OrionAgent")
		esconderJanela(deletarCmd)
		_ = deletarCmd.Run()
		_ = startup.Disable()
		_ = addremove.Remover()

		// Remove atalhos da Área de Trabalho
		publicDesktop := filepath.Join(os.Getenv("PUBLIC"), "Desktop")
		if publicDesktop != "Desktop" && publicDesktop != "" {
			_ = os.Remove(filepath.Join(publicDesktop, "Abrir Chamado Orion.url"))
			_ = os.Remove(filepath.Join(publicDesktop, "Abrir Portal de Chamados.url"))
		}
		if home, err := os.UserHomeDir(); err == nil {
			userDesktop := filepath.Join(home, "Desktop")
			_ = os.Remove(filepath.Join(userDesktop, "Abrir Chamado Orion.url"))
			_ = os.Remove(filepath.Join(userDesktop, "Abrir Portal de Chamados.url"))
		}
		logger.Println("🗑️ Serviço, início automático, atalhos e entrada em Aplicativos Instalados removidos.")

		// Apaga a pasta de instalação inteira (C:\Orion)
		if exe, err := os.Executable(); err == nil {
			pasta := filepath.Dir(exe)
			_ = addremove.LimparPastaDepoisDeSair(pasta)
		}
		return

	default:
		// Se não houver argumentos, estamos rodando o agente "de verdade".
		if !service.Interactive() {
			// Execução como serviço do Windows: sempre sobe o laço completo
			// de coleta+heartbeat+RMM, sem depender da checagem de
			// instância única abaixo — o SCM já garante que só existe uma
			// cópia deste serviço, e recusar a iniciar por causa de uma
			// bandeja interativa que porventura já esteja rodando deixaria
			// o serviço inteiro fora do ar (pior que o problema que a
			// checagem tentava evitar).
			if err := s.Run(); err != nil {
				logger.Fatalf("[ERRO] Falha na execução do serviço: %v", err)
			}
			return
		}

		// Verifica se o serviço Windows OrionAgent já está ativo em segundo plano
		servicoAtivo := false
		queryCmd := exec.Command("sc", "query", "OrionAgent")
		esconderJanela(queryCmd)
		if out, err := queryCmd.CombinedOutput(); err == nil && strings.Contains(string(out), "RUNNING") {
			servicoAtivo = true
		}

		if !servicoAtivo {
			go func() {
				logger.Printf("Iniciando monitoramento em background — Servidor: %s", cfg.APIURL)
				if err := s.Run(); err != nil {
					logger.Printf("[ERRO] Falha na execução de background: %v", err)
				}
			}()
		} else {
			logger.Println("Serviço OrionAgent já está ativo em segundo plano — bandeja sobe só como interface, sem laço de heartbeat próprio.")
			if err := svc.PreloadMachineToken(); err != nil {
				logger.Printf("[AVISO] Não foi possível ler a identidade da máquina salva em disco: %v", err)
			}
		}

		// Garante que o atalho "Abrir Chamado Orion" com o ícone do sistema exista no Desktop
		_ = shortcut.CreatePortalShortcut(cfg.APIURL, svc.GetTicketURL())

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
				//
				// Antes, isso era os.Exit(0) — que pula TODOS os defer deste
				// main() (inclusive logFile.Close()) e podia cortar uma
				// escrita em andamento no arquivo de identidade
				// (token.SaveToken) ou no atalho do Desktop no meio,
				// deixando-os truncados ou corrompidos (correção B.10).
				//
				// svc.Stop cancela o contexto do loop principal e ESPERA
				// (com prazo) ele terminar de verdade. Depois disso, só
				// retornamos do callback: o systray já está encerrando
				// sozinho (foi o clique em "Sair" que disparou isso — ver
				// tray/tray.go), e quando t.Run() devolver o controle em
				// main(), a função termina normalmente e os defer rodam.
				logger.Println("[TRAY] Encerrando o agente Orion por solicitação do usuário.")
				if err := svc.Stop(nil); err != nil {
					logger.Printf("[AVISO] Erro ao encerrar o loop principal: %v", err)
				}
			},
		)

		// Define status inicial correto antes de abrir o loop da bandeja
		if svc.GetPortalURL() != "" {
			t.SetStatus("conectado")
		} else {
			if err := svc.PreloadMachineToken(); err == nil && svc.GetPortalURL() != "" {
				t.SetStatus("conectado")
			} else {
				t.SetStatus("conectando…")
			}
		}

		// Mantém o status sincronizado periodicamente
		go func() {
			for {
				time.Sleep(5 * time.Second)
				if svc.GetPortalURL() != "" {
					t.SetStatus("conectado")
				} else {
					if err := svc.PreloadMachineToken(); err == nil && svc.GetPortalURL() != "" {
						t.SetStatus("conectado")
					} else {
						t.SetStatus("conectando…")
					}
				}
			}
		}()

		// Auto-recarregar a bandeja depois de uma auto-atualização remota.
		//
		// pararServicoSeRodando (cmd/installer/main.go) tenta matar esta
		// bandeja via taskkill antes de sobrescrever orion-agent.exe, mas
		// quando o instalador roda em modo silencioso (disparado pelo
		// serviço durante auto-atualização) ele executa sob a conta virtual
		// NT SERVICE\OrionAgent — sem privilégio pra encerrar um processo
		// rodando na sessão interativa do usuário (mesma classe de limite
		// de privilégio entre sessões já documentada em
		// gravarExeMesmoEmUso/concederAutoGerenciamento). Resultado: o
		// arquivo em disco e o serviço avançam de versão, mas esta bandeja
		// continua rodando o binário antigo pra sempre — exatamente o "a
		// versão na bandeja não atualiza" relatado.
		//
		// Em vez de depender de outro processo conseguir nos matar, nos
		// vigiamos: se o mtime do nosso próprio executável mudar (o
		// instalador reescreveu o arquivo), relançamos uma cópia nova de
		// nós mesmos e encerramos esta de forma graciosa (mesmo caminho do
		// clique em "Sair" — ver TrayManager.Quit).
		if exePath, errExe := os.Executable(); errExe == nil {
			if infoInicial, err := os.Stat(exePath); err == nil {
				mtimeInicial := infoInicial.ModTime()
				go func() {
					ticker := time.NewTicker(60 * time.Second)
					defer ticker.Stop()
					for range ticker.C {
						info, err := os.Stat(exePath)
						if err != nil || !binarioFoiAtualizado(mtimeInicial, info.ModTime()) {
							continue
						}
						logger.Println("[INFO] Binário do agente foi atualizado em disco — reiniciando a bandeja para carregar a versão nova.")
						nova := exec.Command(exePath)
						esconderJanela(nova)
						if err := nova.Start(); err != nil {
							logger.Printf("[ERRO] Falha ao relançar a bandeja após atualização: %v", err)
							continue
						}
						t.Quit()
						return
					}
				}()
			}
		}

		t.Run()
	}
}

// redigirQuery remove a query string de uma URL antes de registrá-la em log.
//
// As URLs do portal carregam o machine_token — credencial que concede sessão
// autenticada sem senha — como parâmetro. Sem esta redação, cada clique na bandeja
// gravava essa credencial em texto plano no agent.log, que fica na pasta do
// executável e herda a ACL do diretório (legível por usuários comuns).
// binarioFoiAtualizado decide se o mtime atual do executável indica que ele
// foi reescrito em disco desde que este processo começou a rodar — critério
// que a checagem periódica de auto-restart da bandeja usa (ver main()).
// Extraída pra ser testável sem precisar de um os.Stat de verdade.
func binarioFoiAtualizado(mtimeInicial, mtimeAtual time.Time) bool {
	return mtimeAtual.After(mtimeInicial)
}

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

// setupLogger configura a escrita de logs para um arquivo local na mesma pasta do
// executável. Isso ajuda muito no troubleshooting quando o agente está rodando
// como SYSTEM.
//
// nomeArquivo vem de cfg.LogFile (correção B.15): antes, o nome era sempre
// "agent.log" hardcoded, e o campo log_file do agent.yaml — documentado no
// próprio arquivo de exemplo como configurável — era parseado e nunca lido de
// volta em lugar nenhum. Se vier vazio (não deveria, config.Load já aplica um
// default), caímos em "agent.log" como última rede de segurança.
func setupLogger(nomeArquivo string) (*log.Logger, *os.File, error) {
	if nomeArquivo == "" {
		nomeArquivo = "agent.log"
	}

	exe, err := os.Executable()
	if err != nil {
		return nil, nil, err
	}
	dir := filepath.Dir(exe)
	logPath := filepath.Join(dir, nomeArquivo)

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return nil, nil, err
	}

	// Escrevemos simultaneamente no arquivo e no console (se houver um aberto).
	w := io.MultiWriter(f, os.Stderr)
	logger := log.New(w, "", log.LstdFlags)
	return logger, f, nil
}
