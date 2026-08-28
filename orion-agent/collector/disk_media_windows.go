//go:build windows

package collector

import (
	"regexp"

	"github.com/yusufpapurcu/wmi"
)

// msftPhysicalDisk espelha só os campos usados de MSFT_PhysicalDisk, a
// classe que o próprio Windows usa (Otimizar Unidades, PowerShell
// Get-PhysicalDisk) pra saber se um disco é SSD ou HD — vive num namespace
// WMI diferente do resto da coleta (root\Microsoft\Windows\Storage, não
// root\cimv2), por isso a consulta usa wmi.QueryNamespace em vez de
// wmi.Query.
//
// DeviceId é documentado pela Microsoft como o mesmo número que
// Win32_DiskDrive.Index (ambos numeram os discos físicos na mesma ordem,
// começando em 0) — é essa igualdade que permite correlacionar sem
// precisar de outra chamada.
type msftPhysicalDisk struct {
	DeviceId  string
	MediaType uint16
}

// win32DiskDriveToDiskPartition e win32LogicalDiskToPartition são as
// classes de ASSOCIAÇÃO do WMI que ligam disco físico → partição → letra
// de unidade. Cada linha é um par de "caminhos de objeto" WMI (strings
// tipo `\\HOST\root\cimv2:Win32_DiskDrive.DeviceID="\\.\PHYSICALDRIVE0"`),
// não valores diretos — extrairDeviceID abaixo faz o parsing.
type win32DiskDriveToDiskPartition struct {
	Antecedent string // Win32_DiskDrive (\\.\PHYSICALDRIVEn)
	Dependent  string // Win32_DiskPartition ("Disk #n, Partition #m")
}

type win32LogicalDiskToPartition struct {
	Antecedent string // Win32_DiskPartition ("Disk #n, Partition #m")
	Dependent  string // Win32_LogicalDisk ("C:")
}

var (
	regexDeviceID            = regexp.MustCompile(`DeviceID="([^"]+)"`)
	regexIndiceDoDiscoFisico = regexp.MustCompile(`PHYSICALDRIVE(\d+)`)
)

// extrairDeviceID lê o valor de DeviceID de dentro de um caminho de objeto
// WMI — funciona igual pros três formatos que aparecem aqui
// (\\.\PHYSICALDRIVEn, "Disk #n, Partition #m", e "C:"), já que os três são
// só o conteúdo de DeviceID="...".
func extrairDeviceID(caminhoDeObjeto string) string {
	m := regexDeviceID.FindStringSubmatch(caminhoDeObjeto)
	if len(m) != 2 {
		return ""
	}
	return m[1]
}

// tipoDeMidia traduz o código MediaType do MSFT_PhysicalDisk (0 =
// Unspecified, 3 = HDD, 4 = SSD — únicos valores documentados pela
// Microsoft) pro rótulo que aparece na telemetria. Qualquer coisa fora
// desses três vira "" (desconhecido) — nunca inventa um tipo.
func tipoDeMidia(mediaType uint16) string {
	switch mediaType {
	case 3:
		return "HD"
	case 4:
		return "SSD"
	default:
		return ""
	}
}

// coletarTiposDeMidiaPorLetra devolve um mapa "C:" -> "SSD"/"HD" pra cada
// letra de unidade que o Windows conseguiu associar a um disco físico
// local. Unidades de rede mapeadas, ou letras que o WMI não conseguiu
// associar por qualquer motivo, simplesmente não aparecem no mapa — o
// chamador trata ausência como "" (desconhecido), nunca como erro fatal:
// best-effort, igual ao resto da coleta de hardware.
func coletarTiposDeMidiaPorLetra() map[string]string {
	resultado := map[string]string{}

	var discosFisicos []msftPhysicalDisk
	if err := wmi.QueryNamespace(
		"SELECT DeviceId, MediaType FROM MSFT_PhysicalDisk",
		&discosFisicos,
		`root\Microsoft\Windows\Storage`,
	); err != nil || len(discosFisicos) == 0 {
		return resultado
	}
	mediaTypePorIndiceDoDisco := map[string]uint16{}
	for _, d := range discosFisicos {
		mediaTypePorIndiceDoDisco[d.DeviceId] = d.MediaType
	}

	var discoParaParticao []win32DiskDriveToDiskPartition
	if err := wmi.Query("SELECT Antecedent, Dependent FROM Win32_DiskDriveToDiskPartition", &discoParaParticao); err != nil {
		return resultado
	}
	indiceDoDiscoPorParticao := map[string]string{}
	for _, r := range discoParaParticao {
		particao := extrairDeviceID(r.Dependent)
		discoFisico := extrairDeviceID(r.Antecedent)
		if particao == "" || discoFisico == "" {
			continue
		}
		m := regexIndiceDoDiscoFisico.FindStringSubmatch(discoFisico)
		if len(m) != 2 {
			continue
		}
		indiceDoDiscoPorParticao[particao] = m[1]
	}

	var particaoParaLetra []win32LogicalDiskToPartition
	if err := wmi.Query("SELECT Antecedent, Dependent FROM Win32_LogicalDiskToPartition", &particaoParaLetra); err != nil {
		return resultado
	}
	for _, r := range particaoParaLetra {
		particao := extrairDeviceID(r.Antecedent)
		letra := extrairDeviceID(r.Dependent)
		if particao == "" || letra == "" {
			continue
		}
		indiceDoDisco, ok := indiceDoDiscoPorParticao[particao]
		if !ok {
			continue
		}
		mediaType, ok := mediaTypePorIndiceDoDisco[indiceDoDisco]
		if !ok {
			continue
		}
		if tipo := tipoDeMidia(mediaType); tipo != "" {
			resultado[letra] = tipo
		}
	}

	return resultado
}
