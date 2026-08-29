//go:build windows

package collector

import (
	"strings"

	"github.com/yusufpapurcu/wmi"
)

// win32ComputerSystem: Manufacturer/Model são preenchidos pelo hypervisor em
// praticamente toda VM de análise dinâmica (sandbox multi-engine tipo
// VirusTotal, Any.Run, Joe Sandbox) — essas ferramentas rodam o binário numa
// VM descartável para observar comportamento, e a própria VM se anuncia via
// estes campos WMI.
type win32ComputerSystem struct {
	Manufacturer string
	Model        string
}

// fabricantesDeVirtualizacao: strings exatas que os hypervisors mais comuns
// gravam em Win32_ComputerSystem — "innotek GmbH" é o nome legado do
// VirtualBox (mantido pela Oracle por compatibilidade), ainda o valor mais
// comum visto em Manufacturer mesmo em builds recentes.
var fabricantesDeVirtualizacao = []string{
	"virtualbox",
	"innotek gmbh",
	"vmware",
	"qemu",
	"xen",
	"bochs",
	"parallels",
}

// DetectarAmbienteDeSandbox consulta o WMI em busca de sinais de que esta
// execução roda numa VM de análise dinâmica, não numa máquina real do
// parque do cliente. Usado apenas no primeiro registro de uma máquina (ver
// tick() em service/windows.go) — depois de aprovada, uma máquina legítima
// que por acaso seja uma VM de produção (Hyper-V, VMware ESXi em uso real)
// já passou pelo gate manual e não é mais reavaliada aqui.
//
// Best-effort: falha de consulta (WMI indisponível, permissão) apenas
// retorna false — nunca bloqueia o registro por incerteza, só por sinal
// positivo confirmado.
func DetectarAmbienteDeSandbox() bool {
	var resultado []win32ComputerSystem
	if err := wmi.Query("SELECT Manufacturer, Model FROM Win32_ComputerSystem", &resultado); err != nil || len(resultado) == 0 {
		return false
	}
	info := resultado[0]
	texto := strings.ToLower(info.Manufacturer + " " + info.Model)
	for _, fabricante := range fabricantesDeVirtualizacao {
		if strings.Contains(texto, fabricante) {
			return true
		}
	}
	return false
}
