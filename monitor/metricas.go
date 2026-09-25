package monitor

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"
)

// Metricas guarda a última amostra de cada máquina em memória e a expõe no
// formato de texto do Prometheus. O histórico é do Prometheus, que faz o
// scrape: aqui só existe o "agora".
//
// Labels só de baixa cardinalidade e estáveis por máquina: machine_id,
// company_id, hostname e device_type. Nada de usuário logado, IP ou
// timestamp em label — cada valor novo viraria uma série nova.
type Metricas struct {
	mu       sync.RWMutex
	amostras map[string]Amostra

	recebidas  uint64
	rejeitadas uint64
	errosBanco uint64
}

func NovasMetricas() *Metricas {
	return &Metricas{amostras: make(map[string]Amostra)}
}

// Registrar guarda a amostra, a menos que ela seja mais velha que a atual.
func (m *Metricas) Registrar(a Amostra) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if atual, ok := m.amostras[a.MachineID]; ok && atual.RecebidaEm.After(a.RecebidaEm) {
		return
	}
	// Os blocos de inventário não entram nas métricas; não vale segurar em
	// memória.
	a.Disks, a.Interfaces, a.Security, a.RemoteSoftware, a.Battery, a.UpdateStatus = nil, nil, nil, nil, nil, nil
	a.Links = nil
	m.amostras[a.MachineID] = a
}

// ServidorDaEmpresa escolhe a sonda padrão dos links de uma empresa: o
// servidor dela que mandou heartbeat por último, dentro da validade.
func (m *Metricas) ServidorDaEmpresa(companyID string, agora time.Time) string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	escolhido, maisRecente := "", time.Time{}
	for id, a := range m.amostras {
		if a.CompanyID != companyID || a.DeviceType != "server" || agora.Sub(a.RecebidaEm) > validadeDaAmostra {
			continue
		}
		if a.RecebidaEm.After(maisRecente) || (a.RecebidaEm.Equal(maisRecente) && id < escolhido) {
			escolhido, maisRecente = id, a.RecebidaEm
		}
	}
	return escolhido
}

func (m *Metricas) contar(campo *uint64) {
	m.mu.Lock()
	*campo++
	m.mu.Unlock()
}

func (m *Metricas) Recebida()  { m.contar(&m.recebidas) }
func (m *Metricas) Rejeitada() { m.contar(&m.rejeitadas) }
func (m *Metricas) ErroBanco() { m.contar(&m.errosBanco) }

func rotular(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return strings.ReplaceAll(s, "\n", `\n`)
}

type serie struct {
	nome, ajuda string
	valor       func(a *Amostra) (float64, bool)
}

var series = []serie{
	{"orion_machine_cpu_percent", "Uso de CPU em porcentagem", func(a *Amostra) (float64, bool) { return a.CPUUsage, true }},
	{"orion_machine_memory_percent", "Uso de memória em porcentagem", func(a *Amostra) (float64, bool) { p := a.RAMPct(); return p, p >= 0 }},
	{"orion_machine_disk_percent", "Uso de disco em porcentagem", func(a *Amostra) (float64, bool) { p := a.DiskPct(); return p, p >= 0 }},
	{"orion_machine_memory_used_bytes", "Memória usada em bytes", func(a *Amostra) (float64, bool) { return float64(a.RAMUsed), a.RAMTotal > 0 }},
	{"orion_machine_disk_used_bytes", "Disco usado em bytes", func(a *Amostra) (float64, bool) { return float64(a.DiskUsed), a.DiskTotal > 0 }},
	{"orion_machine_uptime_seconds", "Tempo ligado em segundos", func(a *Amostra) (float64, bool) { return float64(a.Uptime), true }},
	{"orion_machine_last_seen_timestamp_seconds", "Momento do último heartbeat (unix)", func(a *Amostra) (float64, bool) {
		return float64(a.RecebidaEm.Unix()), true
	}},
}

// validadeDaAmostra: depois disso a máquina sai do /metrics. Sem esse corte,
// uma máquina desligada continuaria publicada com o último valor, e o
// Prometheus gravaria uma linha reta no gráfico como se ela ainda estivesse
// medindo. 15 minutos são três heartbeats de estação de trabalho perdidos.
const validadeDaAmostra = 15 * time.Minute

// Escrever produz o texto do /metrics.
func (m *Metricas) Escrever(w io.Writer, agora time.Time) {
	m.mu.RLock()
	ids := make([]string, 0, len(m.amostras))
	for id := range m.amostras {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	amostras := make([]Amostra, len(ids))
	for i, id := range ids {
		amostras[i] = m.amostras[id]
	}
	vigentes := amostras[:0]
	for _, a := range amostras {
		if agora.Sub(a.RecebidaEm) <= validadeDaAmostra {
			vigentes = append(vigentes, a)
		}
	}
	amostras = vigentes
	recebidas, rejeitadas, errosBanco := m.recebidas, m.rejeitadas, m.errosBanco
	m.mu.RUnlock()

	for _, s := range series {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", s.nome, s.ajuda, s.nome)
		for i := range amostras {
			a := &amostras[i]
			if v, ok := s.valor(a); ok {
				fmt.Fprintf(w, "%s{machine_id=\"%s\",company_id=\"%s\",hostname=\"%s\",device_type=\"%s\"} %g\n",
					s.nome, rotular(a.MachineID), rotular(a.CompanyID), rotular(a.Hostname), rotular(a.DeviceType), v)
			}
		}
	}

	// Métricas do próprio Monitor: o monitoramento também precisa ser
	// monitorado.
	fmt.Fprintf(w, "# HELP orion_monitor_machines Máquinas com amostra em memória\n# TYPE orion_monitor_machines gauge\norion_monitor_machines %d\n", len(amostras))
	fmt.Fprintf(w, "# HELP orion_monitor_samples_received_total Amostras aceitas\n# TYPE orion_monitor_samples_received_total counter\norion_monitor_samples_received_total %d\n", recebidas)
	fmt.Fprintf(w, "# HELP orion_monitor_samples_rejected_total Amostras recusadas (autenticação ou validação)\n# TYPE orion_monitor_samples_rejected_total counter\norion_monitor_samples_rejected_total %d\n", rejeitadas)
	fmt.Fprintf(w, "# HELP orion_monitor_db_errors_total Falhas ao gravar no banco do monitor\n# TYPE orion_monitor_db_errors_total counter\norion_monitor_db_errors_total %d\n", errosBanco)
}
