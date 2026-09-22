package main

import (
	"bytes"
	"testing"
)

// TestAgenteEmbutido_DescompactaUmExecutavelWindows garante que o gzip
// embutido abre e devolve um PE válido (cabeçalho "MZ"), e não os bytes
// compactados.
func TestAgenteEmbutido_DescompactaUmExecutavelWindows(t *testing.T) {
	agente, err := agenteEmbutido()
	if err != nil {
		t.Fatalf("agenteEmbutido: %v", err)
	}
	if !bytes.HasPrefix(agente, []byte("MZ")) {
		t.Fatalf("bytes descompactados não começam com MZ")
	}
	if len(agente) <= len(agenteCompactado) {
		t.Errorf("descompactado (%d) não é maior que o compactado (%d)", len(agente), len(agenteCompactado))
	}
}
