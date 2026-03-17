package tray

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/pkg/browser"
)

type TrayManager struct {
	OnOpenPortal func()
	OnExit       func()
}

func New(onOpen func(), onExit func()) *TrayManager {
	return &TrayManager{
		OnOpenPortal: onOpen,
		OnExit:       onExit,
	}
}

func (tm *TrayManager) Run() {
	systray.Run(tm.onReady, tm.onExitInternal)
}

func (tm *TrayManager) onReady() {
	systray.SetIcon(DataIcon)
	systray.SetTitle("Orion Agent")
	systray.SetTooltip("Orion System - Suporte Ativo")

	mOpen := systray.AddMenuItem("Abrir Portal de Suporte", "Acessar o portal de chamados")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerrar o Orion Agent")

	// Monitor signals for cleanup
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				tm.OnOpenPortal()
			case <-mQuit.ClickedCh:
				systray.Quit()
				return
			case <-sigChan:
				systray.Quit()
				return
			}
		}
	}()
}

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
