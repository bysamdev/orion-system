package handler

import "testing"

func TestProblemaNaSenhaNova(t *testing.T) {
	casos := map[string]bool{
		"":             false,
		"curta1":       false,
		"12345678":     true,
		" comespaco1":  false,
		"comespaco1 ":  false,
		"Senha forte!": true,
	}
	for senha, valida := range casos {
		if got := problemaNaSenhaNova(senha) == ""; got != valida {
			t.Errorf("problemaNaSenhaNova(%q) válida=%v, esperado %v", senha, got, valida)
		}
	}
}
