//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// esconderJanela evita que um exec.Command pra um app de console
// (sc.exe, etc.) abra e feche uma janela visível na tela — main.go não
// tem sufixo _windows.go (roda a checagem de build em qualquer GOOS), mas
// syscall.SysProcAttr.HideWindow só existe na build do syscall pra
// Windows, daí este arquivo à parte.
func esconderJanela(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
