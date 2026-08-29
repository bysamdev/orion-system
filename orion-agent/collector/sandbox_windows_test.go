//go:build windows

package collector

import "testing"

// TestDetectarAmbienteDeSandbox_NaoQuebra garante que a consulta a
// Win32_ComputerSystem não entra em pânico e devolve um bool determinístico
// nesta máquina (mesmo critério de device_type_windows_test.go — não afirma
// um resultado específico, já que rodar dentro ou fora de VM varia por
// máquina de desenvolvimento).
func TestDetectarAmbienteDeSandbox_NaoQuebra(t *testing.T) {
	primeiro := DetectarAmbienteDeSandbox()
	if atual := DetectarAmbienteDeSandbox(); atual != primeiro {
		t.Errorf("DetectarAmbienteDeSandbox() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

// TestFabricantesDeVirtualizacao_SaoTodosMinusculos documenta o invariante
// que detectarAmbienteDeSandbox depende: a comparação usa strings.Contains
// sobre texto já convertido para minúsculas, então qualquer entrada com
// maiúscula nunca daria match.
func TestFabricantesDeVirtualizacao_SaoTodosMinusculos(t *testing.T) {
	for _, f := range fabricantesDeVirtualizacao {
		lower := toLowerASCII(f)
		if f != lower {
			t.Errorf("fabricantesDeVirtualizacao contém %q, deveria estar em minúsculas (%q)", f, lower)
		}
	}
}

func toLowerASCII(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + ('a' - 'A')
		}
	}
	return string(b)
}
