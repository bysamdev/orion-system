package tray

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/pkg/browser"
)

// TrayManager organiza as ações e o estado da bandeja do sistema vinculadas ao agente.
type TrayManager struct {
	OnOpenPortal func()
	OnOpenTicket func()
	OnExit       func()
}

// New constrói o gerenciador com as funções de callback para abertura de portal, abertura de chamado e encerramento.
func New(onOpen func(), onTicket func(), onExit func()) *TrayManager {
	return &TrayManager{
		OnOpenPortal: onOpen,
		OnOpenTicket: onTicket,
		OnExit:       onExit,
	}
}

// Run inicia o loop principal da bandeja do sistema (bloqueante).
func (tm *TrayManager) Run() {
	systray.Run(tm.onReady, tm.onExitInternal)
}

// onReady configura os itens de menu, ícone e tooltip assim que a bandeja está pronta.
func (tm *TrayManager) onReady() {
	systray.SetIcon(DataIcon) // Ícone embutido no arquivo icon_data.go
	systray.SetTitle("Orion Agent")
	systray.SetTooltip("Orion System - Suporte Ativo")

	// Itens do menu de contexto (clique direito no ícone)
	mOpen := systray.AddMenuItem("Abrir Portal de Suporte", "Acessar o portal de chamados e suporte")
	mTicket := systray.AddMenuItem("Abrir Chamado", "Criar um novo chamado de suporte técnico")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerrar o Orion Agent completamente")

	// Monitoramos sinais do sistema (Ctrl+C, etc) para garantir um desligamento limpo.
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Iniciamos uma goroutine para reagir às interações do usuário sem travar a interface.
	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				// Quando clica em abrir, executamos a função passada no New().
				tm.OnOpenPortal()
			case <-mTicket.ClickedCh:
				// Abre o navegador direto na página de novo chamado.
				tm.OnOpenTicket()
			case <-mQuit.ClickedCh:
				// Finalizamos o systray, o que chamará o tm.onExitInternal.
				systray.Quit()
				return
			case <-sigChan:
				// Caso o Windows peça para encerrar o processo.
				systray.Quit()
				return
			}
		}
	}()
}

// onExitInternal é executado quando o systray finaliza, garantindo que o agente limpe seus recursos.
func (tm *TrayManager) onExitInternal() {
	if tm.OnExit != nil {
		tm.OnExit()
	}
}

func OpenURL(url string) {
	err := browser.OpenURL(url)
	if err != nil {
		fmt.Printf("Erro ao abrir URL: %v\n", err)
	}
}
