//go:build windows

package tray

import (
	"strings"
	"testing"

	"orion-agent/version"
)

// TestSetStatusAntesDeRunNaoEntraEmPanico trava a regressão que derrubava a
// bandeja: SetStatus chamava systray.SetTooltip fora da guarda mStatus != nil,
// então qualquer chamada antes de Run() (systray ainda não inicializado)
// estourava "invalid memory address or nil pointer dereference" em
// winTray.setTooltip e o processo morria antes de desenhar o ícone.
//
// main.go chama SetStatus justamente antes de Run() para já abrir a bandeja
// com o status certo — e o caminho "conectado" é o normal logo depois de
// instalar ou auto-atualizar, com o serviço já no ar. Ou seja: o crash
// acontecia exatamente no cenário mais comum.
func TestSetStatusAntesDeRunNaoEntraEmPanico(t *testing.T) {
	tm := New(func() {}, func() {}, func() {})

	// Sem Run(), mStatus é nil e o systray não foi inicializado.
	for _, msg := range []string{"conectado", "conectando…", "aguardando primeiro check-in…"} {
		tm.SetStatus(msg)
	}

	if tm.status != "aguardando primeiro check-in…" {
		t.Errorf("status guardado = %q, esperado o último SetStatus", tm.status)
	}
}

// TestTooltipVersaoIncluiVersaoInstalada cobre o pedido: passar o mouse no
// ícone precisa mostrar a versão rodando, pra confirmar se a máquina já
// pegou uma atualização sem abrir o painel.
func TestTooltipVersaoIncluiVersaoInstalada(t *testing.T) {
	tt := tooltipVersao("conectado")
	if !strings.Contains(tt, version.Version) {
		t.Errorf("tooltip = %q, não contém a versão %q", tt, version.Version)
	}
	if !strings.Contains(tt, "conectado") {
		t.Errorf("tooltip = %q, não contém o status", tt)
	}
}
