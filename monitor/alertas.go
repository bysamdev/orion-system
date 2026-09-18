package monitor

import (
	"encoding/json"
	"fmt"
)

// Alerta aberto por uma amostra.
type Alerta struct {
	Tipo       string
	Severidade string
	Mensagem   string
}

// TiposDeAlerta são todos os tipos que uma amostra sabe avaliar. Os que não
// abrirem alerta numa amostra são dados como normalizados por ela.
var TiposDeAlerta = []string{"cpu", "ram", "disk", "antivirus", "firewall"}

// Limiares iguais aos do heartbeat da API (handler/mon_handlers.go), para os
// dois caminhos concordarem durante a transição. Se mudar lá, muda aqui.
const (
	limiarCPU   = 85.0
	limiarRAM   = 90.0
	limiarDisco = 90.0
)

type seguranca struct {
	Antivirus []struct {
		Active bool `json:"active"`
	} `json:"antivirus"`
	FirewallActive bool `json:"firewall_active"`
}

// AvaliarAlertas decide, a partir de uma amostra, quais alertas estão
// abertos e quais tipos ela prova estarem normais.
//
// Um tipo que a amostra não consegue avaliar (RAM sem total, segurança não
// reportada) não entra em nenhuma das duas listas: não dá para dizer que
// normalizou algo que não foi medido.
func AvaliarAlertas(a *Amostra) (abertos []Alerta, normais []string) {
	if a.CPUUsage > limiarCPU {
		abertos = append(abertos, Alerta{"cpu", "warning", fmt.Sprintf("Uso de CPU alto: %.1f%%", a.CPUUsage)})
	} else {
		normais = append(normais, "cpu")
	}

	if pct := a.RAMPct(); pct >= 0 {
		if pct > limiarRAM {
			abertos = append(abertos, Alerta{"ram", "warning", fmt.Sprintf("Uso de RAM alto: %.1f%%", pct)})
		} else {
			normais = append(normais, "ram")
		}
	}

	if pct := a.DiskPct(); pct >= 0 {
		if pct > limiarDisco {
			abertos = append(abertos, Alerta{"disk", "critical", fmt.Sprintf("Uso de disco crítico: %.1f%%", pct)})
		} else {
			normais = append(normais, "disk")
		}
	}

	if len(a.Security) > 0 && string(a.Security) != "null" {
		var sec seguranca
		if err := json.Unmarshal(a.Security, &sec); err == nil {
			ativo := false
			for _, av := range sec.Antivirus {
				if av.Active {
					ativo = true
					break
				}
			}
			if ativo {
				normais = append(normais, "antivirus")
			} else {
				abertos = append(abertos, Alerta{"antivirus", "critical", "Antivírus desativado ou ausente"})
			}
			if sec.FirewallActive {
				normais = append(normais, "firewall")
			} else {
				abertos = append(abertos, Alerta{"firewall", "warning", "Firewall do Windows desativado"})
			}
		}
	}
	return abertos, normais
}
