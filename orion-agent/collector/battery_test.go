package collector

import (
	"testing"
)

func TestColetarBateriaNaoEntraEmPanico(t *testing.T) {
	bat := coletarBateria()
	if bat.Percent < 0 || bat.Percent > 100 {
		t.Errorf("bat.Percent fora da faixa 0-100: %d", bat.Percent)
	}
	if bat.Status == "" {
		t.Error("bat.Status não deve ser vazio")
	}
}
