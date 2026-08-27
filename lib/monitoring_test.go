package lib

import "testing"

// TestMachineGhostEmail cobre o contrato que handler/auth_handlers.go
// (machineLogin) e monitoringMachineTickets (handler/mon_handlers.go)
// precisam bater byte a byte: os dois resolvem o mesmo e-mail-fantasma a
// partir do machine_token, e um só encontra os tickets do outro se o
// cálculo for idêntico nos dois lados.
func TestMachineGhostEmail(t *testing.T) {
	casos := []struct {
		nome     string
		token    string
		esperado string
	}{
		{
			nome:     "token longo usa os 12 primeiros chars",
			token:    "abcdef0123456789abcdef0123456789",
			esperado: "machine-abcdef012345@orion.internal",
		},
		{
			nome:     "token curto usa ele inteiro",
			token:    "curto123",
			esperado: "machine-curto123@orion.internal",
		},
		{
			nome:     "token com maiusculas vira minusculo",
			token:    "ABCDEF0123456789",
			esperado: "machine-abcdef012345@orion.internal",
		},
		{
			nome:     "token com exatamente 12 chars",
			token:    "123456789012",
			esperado: "machine-123456789012@orion.internal",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := MachineGhostEmail(c.token); got != c.esperado {
				t.Errorf("MachineGhostEmail(%q) = %q, esperado %q", c.token, got, c.esperado)
			}
		})
	}
}
