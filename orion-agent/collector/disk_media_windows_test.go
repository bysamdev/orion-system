//go:build windows

package collector

import "testing"

// TestExtrairDeviceID cobre o parsing dos formatos de caminho de objeto WMI
// que não têm barra invertida no valor (partição e letra de unidade) —
// caso inequívoco de contar. O caso do disco físico (que TEM barras
// invertidas escapadas dentro do próprio valor, ex.: \\.\PHYSICALDRIVE0)
// é coberto separadamente em TestExtrairIndiceDoDiscoFisico, testando o
// par extrairDeviceID + regexIndiceDoDiscoFisico de ponta a ponta em vez
// de fixar a contagem exata de barras escapadas — é o dado real que
// coletarTiposDeMidiaPorLetra usa, não o valor bruto intermediário.
func TestExtrairDeviceID(t *testing.T) {
	casos := []struct {
		nome     string
		entrada  string
		esperado string
	}{
		{
			nome:     "partição",
			entrada:  `\\SAMUEL\root\cimv2:Win32_DiskPartition.DeviceID="Disk #0, Partition #1"`,
			esperado: "Disk #0, Partition #1",
		},
		{
			nome:     "letra de unidade",
			entrada:  `\\SAMUEL\root\cimv2:Win32_LogicalDisk.DeviceID="C:"`,
			esperado: "C:",
		},
		{
			nome:     "sem DeviceID reconhecível devolve vazio",
			entrada:  "algo completamente diferente",
			esperado: "",
		},
		{
			nome:     "string vazia devolve vazio",
			entrada:  "",
			esperado: "",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := extrairDeviceID(c.entrada); got != c.esperado {
				t.Errorf("extrairDeviceID(%q) = %q, esperado %q", c.entrada, got, c.esperado)
			}
		})
	}
}

// TestExtrairIndiceDoDiscoFisico cobre o caminho real de
// coletarTiposDeMidiaPorLetra pro Antecedent de Win32_DiskDriveToDiskPartition:
// extrairDeviceID seguido de regexIndiceDoDiscoFisico, sobre o formato de
// escape real que o WMI devolve (barras invertidas dobradas dentro do
// valor de DeviceID).
func TestExtrairIndiceDoDiscoFisico(t *testing.T) {
	entrada := `\\SAMUEL\root\cimv2:Win32_DiskDrive.DeviceID="\\\\.\\PHYSICALDRIVE0"`

	deviceID := extrairDeviceID(entrada)
	m := regexIndiceDoDiscoFisico.FindStringSubmatch(deviceID)
	if len(m) != 2 {
		t.Fatalf("regexIndiceDoDiscoFisico não encontrou índice em %q (extraído de %q)", deviceID, entrada)
	}
	if m[1] != "0" {
		t.Errorf("índice extraído = %q, esperado \"0\"", m[1])
	}
}

// TestTipoDeMidia cobre os três valores documentados de MSFT_PhysicalDisk.MediaType
// e garante que qualquer coisa fora deles vira "" em vez de um palpite.
func TestTipoDeMidia(t *testing.T) {
	casos := []struct {
		mediaType uint16
		esperado  string
	}{
		{0, ""},    // Unspecified
		{3, "HD"},  // HDD
		{4, "SSD"}, // SSD
		{5, ""},    // SCM (Storage Class Memory) — não mapeado, fica desconhecido
		{99, ""},   // valor nunca documentado
	}

	for _, c := range casos {
		if got := tipoDeMidia(c.mediaType); got != c.esperado {
			t.Errorf("tipoDeMidia(%d) = %q, esperado %q", c.mediaType, got, c.esperado)
		}
	}
}

// TestColetarTiposDeMidiaPorLetra_NaoQuebra roda contra o WMI real desta
// máquina (mesmo critério de device_type_windows_test.go): o objetivo é
// garantir que nenhuma consulta entra em pânico e que o mapa devolvido
// nunca tem chave ou valor vazio — não afirma quais letras/tipos
// específicos aparecem, já que isso varia por máquina de desenvolvimento.
func TestColetarTiposDeMidiaPorLetra_NaoQuebra(t *testing.T) {
	resultado := coletarTiposDeMidiaPorLetra()
	for letra, tipo := range resultado {
		if letra == "" {
			t.Error("coletarTiposDeMidiaPorLetra() devolveu uma chave vazia")
		}
		if tipo != "SSD" && tipo != "HD" {
			t.Errorf("coletarTiposDeMidiaPorLetra()[%q] = %q, esperado \"SSD\" ou \"HD\"", letra, tipo)
		}
	}
}
