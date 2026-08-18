package collector

import (
	"testing"
)

func TestColetarSoftwaresRemotosNaoEntraEmPanico(t *testing.T) {
	softwares := coletarSoftwaresRemotos()
	// Softwares pode ser vazio ou conter ferramentas instaladas, mas nunca nil
	for _, s := range softwares {
		if s.Name == "" {
			t.Error("Nome do software remoto não deve ser vazio")
		}
	}
}
