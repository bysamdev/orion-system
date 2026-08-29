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
// pânico, devolve valores determinísticos — e não um resultado específico.

func TestTemBateria_NaoQuebra(t *testing.T) {
	disp1, tem1 := temBateria()
	disp2, tem2 := temBateria()
	if disp1 != disp2 || tem1 != tem2 {
		t.Errorf("temBateria() não é estável entre chamadas: (%v,%v) != (%v,%v)", disp1, tem1, disp2, tem2)
	}
}

func TestPareceServidorLinux_NaoQuebra(t *testing.T) {
	disp1, srv1 := pareceServidorLinux()
	disp2, srv2 := pareceServidorLinux()
	if disp1 != disp2 || srv1 != srv2 {
		t.Errorf("pareceServidorLinux() não é estável entre chamadas: (%v,%v) != (%v,%v)", disp1, srv1, disp2, srv2)
	}
}

// TestDetectarTipoDispositivo_RetornaValorValido espelha o teste equivalente
// em device_type_windows_test.go: garante o contrato externo de
// tipoDoDispositivo(), independente do resultado real nesta máquina.
func TestDetectarTipoDispositivo_RetornaValorValido(t *testing.T) {
	tipo, motivo := detectarTipoDispositivo()
	switch tipo {
	case "desktop", "notebook", "server", "unknown":
	default:
		t.Errorf("detectarTipoDispositivo() tipo = %q; esperado \"desktop\", \"notebook\", \"server\" ou \"unknown\"", tipo)
	}
	if motivo == "" {
		t.Error("detectarTipoDispositivo() não informou motivo")
	}
}

// TestDetectarTipoDispositivo_BateriaTemPrioridadeSobreServidor documenta a
// ordem de prioridade em detectarTipoDispositivo(): bateria presente decide
// "notebook" antes mesmo de checar /etc/os-release — evita classificar como
// "server" uma distro server rodando, na prática, num notebook.
func TestDetectarTipoDispositivo_BateriaTemPrioridadeSobreServidor(t *testing.T) {
	_, tem := temBateria()
	if !tem {
		t.Skip("esta máquina não reporta bateria em /sys/class/power_supply — cenário não observável aqui")
	}
	if tipo, _ := detectarTipoDispositivo(); tipo != "notebook" {
		t.Errorf("detectarTipoDispositivo() = %q numa máquina com bateria; esperado \"notebook\"", tipo)
	}
}

// TestDetectarTipoDispositivo_UnknownSoQuandoNenhumSinalDisponivel documenta
// a correção da Fase 3: "unknown" só deve aparecer quando NENHUM dos dois
// sinais (bateria, os-release) pôde ser lido — nunca como default silencioso
// quando os sinais existem mas simplesmente não indicam notebook/servidor.
func TestDetectarTipoDispositivo_UnknownSoQuandoNenhumSinalDisponivel(t *testing.T) {
	dispBateria, _ := temBateria()
	dispOSRelease, _ := pareceServidorLinux()
	tipo, _ := detectarTipoDispositivo()

	algumSinalDisponivel := dispBateria || dispOSRelease
	if tipo == "unknown" && algumSinalDisponivel {
		t.Errorf("detectarTipoDispositivo() = \"unknown\" mas havia sinal disponível (bateria=%v, os-release=%v)", dispBateria, dispOSRelease)
	}
	if tipo != "unknown" && !algumSinalDisponivel {
		t.Errorf("detectarTipoDispositivo() = %q sem nenhum sinal disponível; esperado \"unknown\"", tipo)
	}
}
