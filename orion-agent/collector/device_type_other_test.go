//go:build !windows

package collector

import "testing"

// Ao contrário de device_type_windows_test.go, temBateria() e
// pareceServidorLinux() leem caminhos fixos do sistema (/sys/class/power_supply,
// /etc/os-release) sem parâmetro injetável — não há como forjar "esta máquina
// tem bateria" num teste sem trocar o caminho lido, o que exigiria expor um
// hook só para teste (mesmo trade-off documentado em
// TestPrimeiroIPv4NaoLoopback_ListaVaziaRetornaVazio para não sintetizar
// net.Interface). Por isso estes testes verificam o contrato — não entra em
// pânico, devolve bool determinístico — e não um resultado específico.

func TestTemBateria_NaoQuebra(t *testing.T) {
	primeiro := temBateria()
	if atual := temBateria(); atual != primeiro {
		t.Errorf("temBateria() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

func TestPareceServidorLinux_NaoQuebra(t *testing.T) {
	primeiro := pareceServidorLinux()
	if atual := pareceServidorLinux(); atual != primeiro {
		t.Errorf("pareceServidorLinux() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

// TestDetectarTipoDispositivo_RetornaValorValido espelha o teste equivalente
// em device_type_windows_test.go: garante o contrato externo de
// tipoDoDispositivo(), independente do resultado real nesta máquina.
func TestDetectarTipoDispositivo_RetornaValorValido(t *testing.T) {
	switch got := detectarTipoDispositivo(); got {
	case "desktop", "notebook", "server":
	default:
		t.Errorf("detectarTipoDispositivo() = %q; esperado \"desktop\", \"notebook\" ou \"server\"", got)
	}
}

// TestDetectarTipoDispositivo_BateriaTemPrioridadeSobreServidor documenta a
// ordem de prioridade em detectarTipoDispositivo(): bateria presente decide
// "notebook" antes mesmo de checar /etc/os-release — evita classificar como
// "server" uma distro server rodando, na prática, num notebook.
func TestDetectarTipoDispositivo_BateriaTemPrioridadeSobreServidor(t *testing.T) {
	if !temBateria() {
		t.Skip("esta máquina não reporta bateria em /sys/class/power_supply — cenário não observável aqui")
	}
	if got := detectarTipoDispositivo(); got != "notebook" {
		t.Errorf("detectarTipoDispositivo() = %q numa máquina com temBateria()=true; esperado \"notebook\"", got)
	}
}
