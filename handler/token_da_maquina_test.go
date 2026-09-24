package handler

import "testing"

func TestDecidirTokenDaMaquina(t *testing.T) {
	casos := []struct {
		nome               string
		recebido, esperado string
		exigir             bool
		passa, legado      bool
	}{
		{"token certo passa", "tok-a", "tok-a", false, true, false},
		{"token de outra máquina é recusado", "tok-b", "tok-a", false, false, false},
		{"agente antigo sem cabeçalho passa na transição", "", "tok-a", false, true, true},
		{"agente antigo sem cabeçalho é recusado quando exigir", "", "tok-a", true, false, true},
		{"máquina sem token no banco nunca confere", "tok-a", "", false, false, false},
		{"espaços não enganam", " tok-a ", "tok-a", true, true, false},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			passa, legado := decidirTokenDaMaquina(c.recebido, c.esperado, c.exigir)
			if passa != c.passa || legado != c.legado {
				t.Errorf("decidirTokenDaMaquina(%q, %q, %v) = (%v, %v), esperado (%v, %v)",
					c.recebido, c.esperado, c.exigir, passa, legado, c.passa, c.legado)
			}
		})
	}
}
