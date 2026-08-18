package collector

import (
	"testing"
)

func TestIsProductStateActive(t *testing.T) {
	cases := []struct {
		state    uint32
		expected bool
	}{
		{266240, true},  // 0x041000 -> bit 12 set
		{262144, false}, // 0x040000 -> bit 12 not set
		{393472, false}, // 0x060100 -> bit 12 not set
		{397568, true},  // 0x061100 -> bit 12 set
		{0, false},
	}

	for _, c := range cases {
		got := isProductStateActive(c.state)
		if got != c.expected {
			t.Errorf("isProductStateActive(%d / 0x%06x) = %v, esperado %v", c.state, c.state, got, c.expected)
		}
	}
}

func TestColetarSegurancaNaoEntraEmPanico(t *testing.T) {
	sec := coletarSeguranca()
	// Garante que não entra em pânico e preenche estruturas
	if sec.Antivirus == nil {
		t.Error("sec.Antivirus não deve ser nil")
	}
	if sec.BitLocker == nil {
		t.Error("sec.BitLocker não deve ser nil")
	}
}
