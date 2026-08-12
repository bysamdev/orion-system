//go:build windows

package collector

import "testing"

// Estes testes rodam contra o WMI real desta máquina (mesmo critério de
// hardware_test.go: leitura pura, sem escrever nada). O objetivo principal é
// regressão do panic de reflect já corrigido uma vez aqui — ver o comentário
// em win32SystemEnclosure.ChassisTypes — não afirmar um resultado específico,
// já que o tipo de chassi/bateria/SO varia por máquina de desenvolvimento.

// TestEhServidor_NaoQuebra garante que a consulta a Win32_OperatingSystem não
// entra em pânico e devolve um bool determinístico nesta máquina.
func TestEhServidor_NaoQuebra(t *testing.T) {
	primeiro := ehServidor()
	if atual := ehServidor(); atual != primeiro {
		t.Errorf("ehServidor() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

// TestTemBateriaCadastrada_NaoQuebra garante que a consulta a Win32_Battery
// não entra em pânico e devolve um bool determinístico nesta máquina.
func TestTemBateriaCadastrada_NaoQuebra(t *testing.T) {
	primeiro := temBateriaCadastrada()
	if atual := temBateriaCadastrada(); atual != primeiro {
		t.Errorf("temBateriaCadastrada() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

// TestChassiDeNotebook_NaoQuebra é o teste de regressão direto do panic de
// reflect.Value.Uint sobre ChassisTypes: antes da correção de tipo
// ([]uint16 -> []int32, ver win32SystemEnclosure), esta chamada derrubava o
// processo inteiro em qualquer máquina Windows real.
func TestChassiDeNotebook_NaoQuebra(t *testing.T) {
	primeiro := chassiDeNotebook()
	if atual := chassiDeNotebook(); atual != primeiro {
		t.Errorf("chassiDeNotebook() não é estável entre chamadas: %v != %v", atual, primeiro)
	}
}

// TestDetectarTipoDispositivo_RetornaValorValido garante o contrato externo
// da função usada por tipoDoDispositivo(): sempre um dos três valores
// conhecidos, nunca vazio nem um valor inesperado.
func TestDetectarTipoDispositivo_RetornaValorValido(t *testing.T) {
	switch got := detectarTipoDispositivo(); got {
	case "desktop", "notebook", "server":
	default:
		t.Errorf("detectarTipoDispositivo() = %q; esperado \"desktop\", \"notebook\" ou \"server\"", got)
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
	if !ehServidor() {
		t.Skip("esta máquina não reporta ProductType de servidor — cenário não observável aqui")
	}
	if got := detectarTipoDispositivo(); got != "server" {
		t.Errorf("detectarTipoDispositivo() = %q numa máquina com ehServidor()=true; esperado \"server\"", got)
	}
}
