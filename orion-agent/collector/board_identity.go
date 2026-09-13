package collector

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Identidade do computador FÍSICO, independente da instalação do Windows.
//
// machine_token é aleatório e vive em C:\ProgramData (ver token.GenerateRandomIdentity)
// e machine_uuid é o MachineGuid do registro — os dois são regerados quando a
// máquina é formatada. Sem um dado que sobreviva à formatação, cada reinstalação
// criava um segundo registro no inventário para o mesmo computador (caso real:
// SAMUEL e SAM-DESKTOP, mesma placa-mãe). O backend usa os dois valores abaixo
// para reconhecer a máquina e reaproveitar o registro antigo (ver
// lib.UpsertMachine, mesclagem de identidade).
//
// Nenhum dos dois é segredo nem serve de credencial: são só a chave de
// reconhecimento. A autenticação continua sendo o machine_token.

// adaptadorDeRede é o recorte de Win32_NetworkAdapter que importa para achar a
// placa de rede integrada à placa-mãe — separado da consulta WMI para que a
// escolha seja testável em qualquer plataforma.
type adaptadorDeRede struct {
	Nome        string
	MAC         string
	PNPDeviceID string
}

// normalizarMAC devolve o MAC em minúsculas separado por ":", ou "" quando o
// valor não serve para identificar o computador físico: vazio, malformado,
// zerado, multicast/broadcast (bit 0x01 do primeiro octeto) ou administrado
// localmente (bit 0x02) — faixa dos endereços aleatórios que o Windows gera
// para Wi-Fi e dos adaptadores virtuais de VPN/Hyper-V.
func normalizarMAC(bruto string) string {
	limpo := strings.NewReplacer(":", "", "-", "", ".", "").Replace(strings.ToLower(strings.TrimSpace(bruto)))
	if len(limpo) != 12 {
		return ""
	}
	var octetos [6]byte
	for i := range octetos {
		v, err := strconv.ParseUint(limpo[i*2:i*2+2], 16, 8)
		if err != nil {
			return ""
		}
		octetos[i] = byte(v)
	}
	if octetos == [6]byte{} || octetos[0]&0x03 != 0 {
		return ""
	}
	partes := make([]string, len(octetos))
	for i, o := range octetos {
		partes[i] = fmt.Sprintf("%02x", o)
	}
	return strings.Join(partes, ":")
}

// escolherMACDaPlacaMae escolhe, entre os adaptadores físicos, o da placa de
// rede integrada: só dispositivos no barramento PCI (adaptador USB, TAP de VPN
// e placas virtuais ficam de fora — seu PNPDeviceID começa com USB\ ou ROOT\),
// preferindo cabo a Wi-Fi e, no empate, a ordem do PNPDeviceID — para que o
// valor não mude entre coletas conforme a ordem de enumeração do WMI.
//
// Diferente de Payload.MACAddress, que segue a placa carregando o tráfego no
// momento (e alterna quando a máquina troca de cabo para Wi-Fi), este valor
// precisa ser estável: é chave de reconhecimento, não informação de rede.
func escolherMACDaPlacaMae(adaptadores []adaptadorDeRede) string {
	type candidato struct {
		mac    string
		pnp    string
		semFio bool
	}
	var candidatos []candidato
	for _, a := range adaptadores {
		pnp := strings.ToUpper(strings.TrimSpace(a.PNPDeviceID))
		if !strings.HasPrefix(pnp, `PCI\`) {
			continue
		}
		mac := normalizarMAC(a.MAC)
		if mac == "" {
			continue
		}
		candidatos = append(candidatos, candidato{mac: mac, pnp: pnp, semFio: pareceSemFio(a.Nome)})
	}
	if len(candidatos) == 0 {
		return ""
	}
	sort.Slice(candidatos, func(i, j int) bool {
		if candidatos[i].semFio != candidatos[j].semFio {
			return !candidatos[i].semFio
		}
		return candidatos[i].pnp < candidatos[j].pnp
	})
	return candidatos[0].mac
}

func pareceSemFio(nome string) bool {
	n := strings.ToLower(nome)
	for _, s := range []string{"wi-fi", "wifi", "wireless", "wlan", "802.11"} {
		if strings.Contains(n, s) {
			return true
		}
	}
	return false
}

// uuidsGenericosDeFirmware são valores que fabricantes de placa-mãe gravam
// iguais em lotes inteiros quando não personalizam o SMBIOS — tratá-los como
// identidade juntaria computadores diferentes num registro só.
var uuidsGenericosDeFirmware = map[string]struct{}{
	"03000200-0400-0500-0006-000700080009": {},
	"00020003-0004-0005-0006-000700080009": {},
	"12345678-1234-5678-90ab-cddeefaabbcc": {},
}

// normalizarUUIDDeHardware valida o UUID do SMBIOS (Win32_ComputerSystemProduct):
// devolve em minúsculas, ou "" se vazio, malformado, todo zero, todo F ou um dos
// valores genéricos conhecidos.
func normalizarUUIDDeHardware(bruto string) string {
	u := strings.ToLower(strings.TrimSpace(bruto))
	if len(u) != 36 {
		return ""
	}
	for i, c := range u {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return ""
			}
			continue
		}
		if !strings.ContainsRune("0123456789abcdef", c) {
			return ""
		}
	}
	semHifen := strings.ReplaceAll(u, "-", "")
	if strings.Trim(semHifen, "0") == "" || strings.Trim(semHifen, "f") == "" {
		return ""
	}
	if _, generico := uuidsGenericosDeFirmware[u]; generico {
		return ""
	}
	return u
}
