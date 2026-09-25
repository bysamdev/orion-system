package handler

import (
	"testing"

	"orion-api/lib"
)

func TestSondaPertenceAEmpresa(t *testing.T) {
	empresaA := "22222222-2222-2222-2222-222222222222"
	empresaB := "33333333-3333-3333-3333-333333333333"
	casos := []struct {
		nome  string
		sonda *lib.MachineRow
		quer  bool
	}{
		{"mesma empresa", &lib.MachineRow{CompanyID: &empresaA}, true},
		{"outra empresa", &lib.MachineRow{CompanyID: &empresaB}, false},
		{"sem empresa", &lib.MachineRow{}, false},
		{"inexistente", nil, false},
	}
	for _, tc := range casos {
		t.Run(tc.nome, func(t *testing.T) {
			if obtido := sondaPertenceAEmpresa(tc.sonda, empresaA); obtido != tc.quer {
				t.Fatalf("sondaPertenceAEmpresa = %v, esperado %v", obtido, tc.quer)
			}
		})
	}
}
