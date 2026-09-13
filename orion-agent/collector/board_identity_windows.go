//go:build windows

package collector

import (
	"sync"

	"github.com/yusufpapurcu/wmi"
)

// Campos como ponteiro: o WMI devolve NULL em MACAddress/PNPDeviceID para
// alguns adaptadores, e campo não-ponteiro com NULL faz a consulta inteira falhar.
type win32ComputerSystemProduct struct {
	UUID *string
}

type win32NetworkAdapterFisico struct {
	Name        *string
	MACAddress  *string
	PNPDeviceID *string
}

var (
	identidadeHardwareMu sync.Mutex
	uuidHardwareCache    string
	macPlacaMaeCache     string
)

// identidadeDeHardware devolve o UUID do SMBIOS e o MAC da placa de rede
// integrada (ver board_identity.go). Nenhum dos dois muda enquanto o processo
// vive, então ficam em cache — mas só quando encontrados: um adaptador
// desabilitado no boot não congela o valor vazio até o próximo restart.
func identidadeDeHardware() (uuid, mac string) {
	identidadeHardwareMu.Lock()
	defer identidadeHardwareMu.Unlock()

	if uuidHardwareCache == "" {
		var produtos []win32ComputerSystemProduct
		if err := wmi.Query("SELECT UUID FROM Win32_ComputerSystemProduct", &produtos); err == nil && len(produtos) > 0 && produtos[0].UUID != nil {
			uuidHardwareCache = normalizarUUIDDeHardware(*produtos[0].UUID)
		}
	}

	if macPlacaMaeCache == "" {
		var brutos []win32NetworkAdapterFisico
		if err := wmi.Query("SELECT Name, MACAddress, PNPDeviceID FROM Win32_NetworkAdapter WHERE PhysicalAdapter = TRUE", &brutos); err == nil {
			adaptadores := make([]adaptadorDeRede, 0, len(brutos))
			for _, b := range brutos {
				adaptadores = append(adaptadores, adaptadorDeRede{
					Nome:        textoOuVazio(b.Name),
					MAC:         textoOuVazio(b.MACAddress),
					PNPDeviceID: textoOuVazio(b.PNPDeviceID),
				})
			}
			macPlacaMaeCache = escolherMACDaPlacaMae(adaptadores)
		}
	}

	return uuidHardwareCache, macPlacaMaeCache
}

func textoOuVazio(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
