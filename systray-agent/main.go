package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"github.com/getlantern/systray"
	"github.com/getlantern/systray/example/icon"
)

func main() {
	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(icon.Data)
	systray.SetTitle("Orion Agent")
	systray.SetTooltip("Orion System RMM Agent")

	mOpenTicket := systray.AddMenuItem("Abrir Chamado (Portal)", "Abre o portal do Orion System")
	mScreenshot := systray.AddMenuItem("Tirar Screenshot", "Captura a tela atual")
	mSync := systray.AddMenuItem("Sincronizar Ativo", "Envia dados recentes ao RMM")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerrar o agente")

	go func() {
		for {
			select {
			case <-mOpenTicket.ClickedCh:
				openBrowser("https://orion-system.vercel.app")
			case <-mScreenshot.ClickedCh:
				// Placeholder para tirar screenshot
				fmt.Println("Screenshot capturada (stub)")
			case <-mSync.ClickedCh:
				// Placeholder para envio de telemetria ao RMM
				fmt.Println("Ativo sincronizado (stub)")
			case <-mQuit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

func onExit() {
	// Limpeza antes de fechar
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		fmt.Printf("Falha ao abrir navegador: %v\n", err)
	}
}
