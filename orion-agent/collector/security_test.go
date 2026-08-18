package collector

import (
	"testing"
)

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
