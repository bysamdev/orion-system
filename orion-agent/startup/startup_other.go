//go:build !windows

// Package startup gerencia a entrada de auto-início do Orion Agent no login
// do Windows. Sem equivalente fora do Windows — o agente hoje só roda como
// serviço/tray nesta plataforma.
package startup

func Enable(caminhoExe string) error {
	return nil
}

func Disable() error {
	return nil
}
