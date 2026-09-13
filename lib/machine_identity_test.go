package lib

import (
	"reflect"
	"testing"
)

func TestNormalizarMACDeIdentidade(t *testing.T) {
	casos := []struct {
		bruto, esperado string
	}{
		{"3C:7C:3F:79:79:51", "3c:7c:3f:79:79:51"},
		{"3c-7c-3f-79-79-51", "3c:7c:3f:79:79:51"},
		{"", ""},
		{"3c:7c:3f:79:79", ""},
		{"00:00:00:00:00:00", ""},
		{"ff:ff:ff:ff:ff:ff", ""},
		{"02:50:f2:00:00:01", ""}, // administrado localmente
	}
	for _, c := range casos {
		if got := NormalizarMACDeIdentidade(c.bruto); got != c.esperado {
			t.Errorf("NormalizarMACDeIdentidade(%q) = %q, esperado %q", c.bruto, got, c.esperado)
		}
	}
}

func TestNormalizarUUIDDeHardware(t *testing.T) {
	casos := []struct {
		bruto, esperado string
	}{
		{"AC21CF1E-3811-02FB-792E-3C7C3F797951", "ac21cf1e-3811-02fb-792e-3c7c3f797951"},
		{"00000000-0000-0000-0000-000000000000", ""},
		{"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF", ""},
		{"03000200-0400-0500-0006-000700080009", ""},
		{"nao-e-uuid", ""},
	}
	for _, c := range casos {
		if got := NormalizarUUIDDeHardware(c.bruto); got != c.esperado {
			t.Errorf("NormalizarUUIDDeHardware(%q) = %q, esperado %q", c.bruto, got, c.esperado)
		}
	}
}

func TestMontarChavesDeIdentidade(t *testing.T) {
	// Agente novo: placa-mãe e MAC principal iguais (máquina no cabo).
	c := montarChavesDeIdentidade("AC21CF1E-3811-02FB-792E-3C7C3F797951", "3C:7C:3F:79:79:51", "3c:7c:3f:79:79:51")
	if c.hardwareUUID != "ac21cf1e-3811-02fb-792e-3c7c3f797951" || c.boardMAC != "3c:7c:3f:79:79:51" {
		t.Errorf("chaves = %+v", c)
	}
	if !reflect.DeepEqual(c.macs, []string{"3c:7c:3f:79:79:51"}) {
		t.Errorf("macs = %v, esperado um único MAC sem repetição", c.macs)
	}

	// Agente antigo: só mac_address.
	c = montarChavesDeIdentidade("", "", "3c:7c:3f:79:79:51")
	if c.vazia() || !reflect.DeepEqual(c.macs, []string{"3c:7c:3f:79:79:51"}) {
		t.Errorf("agente antigo deveria gerar chave pelo mac_address, obtido %+v", c)
	}

	// Nada utilizável: não tenta mesclar.
	if c := montarChavesDeIdentidade("00000000-0000-0000-0000-000000000000", "02:00:00:00:00:01", ""); !c.vazia() {
		t.Errorf("chaves inválidas deveriam resultar em vazio, obtido %+v", c)
	}
}
