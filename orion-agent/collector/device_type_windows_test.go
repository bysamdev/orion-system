//go:build windows

package collector

import "testing"

// Estes testes rodam contra o WMI real desta máquina (mesmo critério de
// hardware_test.go: leitura pura, sem escrever nada). O objetivo principal é
// regressão do panic de reflect já corrigido uma vez aqui — ver o comentário
// em win32SystemEnclosure.ChassisTypes — não afirmar um resultado específico,
// já que o tipo de chassi/bateria/SO varia por máquina de desenvolvimento.

// TestEhServidor_NaoQuebra garante que a consulta a Win32_OperatingSystem não
// entra em pânico e devolve resultados determinísticos nesta máquina.
func TestEhServidor_NaoQuebra(t *testing.T) {
	sucesso1, servidor1, _ := ehServidor()
	sucesso2, servidor2, _ := ehServidor()
	if sucesso1 != sucesso2 || servidor1 != servidor2 {
		t.Errorf("ehServidor() não é estável entre chamadas: (%v,%v) != (%v,%v)", sucesso1, servidor1, sucesso2, servidor2)
	}
}

// TestTemBateriaCadastrada_NaoQuebra garante que a consulta a Win32_Battery
// não entra em pânico e devolve resultados determinísticos nesta máquina.
func TestTemBateriaCadastrada_NaoQuebra(t *testing.T) {
	sucesso1, tem1 := temBateriaCadastrada()
	sucesso2, tem2 := temBateriaCadastrada()
	if sucesso1 != sucesso2 || tem1 != tem2 {
		t.Errorf("temBateriaCadastrada() não é estável entre chamadas: (%v,%v) != (%v,%v)", sucesso1, tem1, sucesso2, tem2)
	}
}

// TestChassiDeNotebook_NaoQuebra é o teste de regressão direto do panic de
// reflect.Value.Uint sobre ChassisTypes: antes da correção de tipo
// ([]uint16 -> []int32, ver win32SystemEnclosure), esta chamada derrubava o
// processo inteiro em qualquer máquina Windows real.
func TestChassiDeNotebook_NaoQuebra(t *testing.T) {
	sucesso1, notebook1, _ := chassiDeNotebook()
	sucesso2, notebook2, _ := chassiDeNotebook()
	if sucesso1 != sucesso2 || notebook1 != notebook2 {
		t.Errorf("chassiDeNotebook() não é estável entre chamadas: (%v,%v) != (%v,%v)", sucesso1, notebook1, sucesso2, notebook2)
	}
}

// TestDetectarTipoDispositivo_RetornaValorValido garante o contrato externo
// da função usada por tipoDoDispositivo(): sempre um dos valores conhecidos
// e um motivo não vazio, nunca um valor inesperado.
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

// TestDetectarTipoDispositivo_ServidorTemPrioridadeSobreBateria documenta a
// ordem de prioridade deliberada em detectarTipoDispositivo(): um SO Server
// é reportado como "server" mesmo que a checagem de bateria/chassi (mais
// abaixo na função) também desse positivo para notebook — cenário raro
// (VM de servidor rodando em host laptop), mas a ordem do código é a garantia
// de que "server" sempre vence, e este teste trava essa garantia via reflexão
// do fluxo real, não de um cenário sintético (não dá para forjar
// Win32_OperatingSystem nesta suíte sem mockar o WMI).
func TestDetectarTipoDispositivo_ServidorTemPrioridadeSobreBateria(t *testing.T) {
	_, servidor, _ := ehServidor()
	if !servidor {
		t.Skip("esta máquina não reporta ProductType de servidor — cenário não observável aqui")
	}
	if tipo, _ := detectarTipoDispositivo(); tipo != "server" {
		t.Errorf("detectarTipoDispositivo() = %q numa máquina com ehServidor()=true; esperado \"server\"", tipo)
	}
}

// TestDetectarTipoDispositivo_UnknownSoQuandoNenhumaConsultaWMITeveSucesso
// documenta a correção da Fase 3: "unknown" só deve aparecer quando as três
// consultas WMI falharam — nunca como default silencioso quando pelo menos
// uma respondeu mas simplesmente não indicou notebook/servidor.
func TestDetectarTipoDispositivo_UnknownSoQuandoNenhumaConsultaWMITeveSucesso(t *testing.T) {
	osOK, _, _ := ehServidor()
	bateriaOK, _ := temBateriaCadastrada()
	chassiOK, _, _ := chassiDeNotebook()
	tipo, _ := detectarTipoDispositivo()

	algumaConsultaOK := osOK || bateriaOK || chassiOK
	if tipo == "unknown" && algumaConsultaOK {
		t.Errorf("detectarTipoDispositivo() = \"unknown\" mas ao menos uma consulta WMI teve sucesso (os=%v, bateria=%v, chassi=%v)", osOK, bateriaOK, chassiOK)
	}
	if tipo != "unknown" && !algumaConsultaOK {
		t.Errorf("detectarTipoDispositivo() = %q sem nenhuma consulta WMI ter sucesso; esperado \"unknown\"", tipo)
	}
}
