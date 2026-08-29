//go:build !windows

package main

import "os/exec"

// esconderJanela é no-op fora do Windows — não existe janela de console
// pra esconder, e o próprio comando "sc" nem existe nessas plataformas.
func esconderJanela(cmd *exec.Cmd) {}
