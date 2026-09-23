package handler

import (
	"encoding/json"
	"sort"
	"testing"

	"orion-api/monitor"
)

// O heartbeat passou a decidir os alertas com monitor.AvaliarAlertas
// (ORN-DUP-03). Estes casos fixam os limiares que o heartbeat usava antes da
// troca, para a unificação não mudar quando uma máquina entra em alerta.
func TestHeartbeatUsaOsMesmosLimiaresDeAntes(t *testing.T) {
	const gb = int64(1 << 30)
	seguranca := func(av, fw bool) json.RawMessage {
		b, _ := json.Marshal(map[string]any{
			"antivirus":       []map[string]any{{"active": av}},
			"firewall_active": fw,
		})
		return b
	}

	casos := []struct {
		nome    string
		amostra monitor.Amostra
		abertos []string
	}{
		{"tudo normal", monitor.Amostra{CPUUsage: 85, RAMTotal: 10 * gb, RAMUsed: 9 * gb, DiskTotal: 10 * gb, DiskUsed: 9 * gb, Security: seguranca(true, true)}, nil},
		{"cpu acima de 85", monitor.Amostra{CPUUsage: 85.1}, []string{"cpu"}},
		{"ram acima de 90%", monitor.Amostra{RAMTotal: 100, RAMUsed: 91}, []string{"ram"}},
		{"disco acima de 90%", monitor.Amostra{DiskTotal: 100, DiskUsed: 91}, []string{"disk"}},
		{"antivírus e firewall desligados", monitor.Amostra{Security: seguranca(false, false)}, []string{"antivirus", "firewall"}},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			abertos, _ := monitor.AvaliarAlertas(&c.amostra)
			var tipos []string
			for _, a := range abertos {
				tipos = append(tipos, a.Tipo)
			}
			sort.Strings(tipos)
			if len(tipos) != len(c.abertos) {
				t.Fatalf("abertos = %v, esperado %v", tipos, c.abertos)
			}
			for i := range tipos {
				if tipos[i] != c.abertos[i] {
					t.Fatalf("abertos = %v, esperado %v", tipos, c.abertos)
				}
			}
		})
	}
}

func TestMensagemDoChamadoDeServidor(t *testing.T) {
	disco := mensagemDoChamadoDeServidor(monitor.Alerta{Tipo: "disk", Mensagem: "Uso de disco crítico: 95.0%"})
	if disco != "Uso de disco crítico no servidor: 95.0%" {
		t.Errorf("disco: %q", disco)
	}
	av := mensagemDoChamadoDeServidor(monitor.Alerta{Tipo: "antivirus", Mensagem: "Antivírus desativado ou ausente"})
	if av != "Antivírus desativado ou ausente no servidor" {
		t.Errorf("antivírus: %q", av)
	}
}
