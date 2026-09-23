package lib

import (
	"testing"
	"time"
)

// O texto sai no fuso de Brasília (-3h), não em UTC.
func TestAgoraFormatadoUsaHorarioDeBrasilia(t *testing.T) {
	esperado := time.Now().UTC().Add(-3 * time.Hour).Format("02/01/2006 15:04")
	if got := AgoraFormatado(); got[:16] != esperado {
		t.Errorf("AgoraFormatado() = %q, esperado começar com %q", got, esperado)
	}
}
