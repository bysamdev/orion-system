//go:build windows

package tray

import "testing"

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
