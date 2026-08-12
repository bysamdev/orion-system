//go:build !windows

package shortcut

import "testing"

// TestCreatePortalShortcut_ForaDoWindowsEhNoOp garante que, fora do Windows,
// CreatePortalShortcut não faz nada e nunca retorna erro. É seguro chamar a
// função real aqui — diferente da versão Windows, shortcut_other.go não faz
// nenhum I/O; ver shortcut_other.go (correção B.14).
func TestCreatePortalShortcut_ForaDoWindowsEhNoOp(t *testing.T) {
	if err := CreatePortalShortcut("https://orion.exemplo.test", "tok-qualquer"); err != nil {
		t.Fatalf("CreatePortalShortcut fora do Windows deveria ser no-op, retornou erro: %v", err)
	}
}
