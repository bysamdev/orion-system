// Package monitor é o Orion Monitor: o serviço que tira o monitoramento de
// máquinas do Supabase.
//
// Roda no servidor de monitoramento, com Postgres próprio, ao lado do
// Prometheus e do Grafana. Guarda o estado atual de cada máquina (status,
// última vez vista, CPU, RAM, disco), o inventário de hardware e os alertas, e
// expõe as métricas em /metrics para o Prometheus guardar o histórico.
//
// Se este serviço cair, o Orion (chamados, usuários, empresas) continua
// funcionando: só as telas de monitoramento ficam sem dado novo.
//
// Fase 1 (modo sombra): a API na Vercel continua fazendo tudo como antes e
// repassa uma cópia de cada heartbeat aceito para cá. Nada do que existe
// depende deste serviço ainda. Ver o card "Separar o monitoramento em serviço
// próprio" no Notion.
package monitor

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Amostra é um heartbeat já autenticado pela API do Orion.
//
// Chega com machine_id e company_id resolvidos: nesta fase quem valida a
// chave do agente e identifica a máquina é a API, e o Monitor confia nela
// pelo segredo de ingestão.
type Amostra struct {
	MachineID    string `json:"machine_id"`
	CompanyID    string `json:"company_id"`
	Hostname     string `json:"hostname"`
	DeviceType   string `json:"device_type"`
	AgentVersion string `json:"agent_version"`
	OS           string `json:"os"`
	OSVersion    string `json:"os_version"`
	IP           string `json:"ip"`
	CurrentUser  string `json:"current_user"`

	CPUUsage  float64 `json:"cpu_usage"`
	RAMTotal  int64   `json:"ram_total"`
	RAMUsed   int64   `json:"ram_used"`
	DiskTotal int64   `json:"disk_total"`
	DiskUsed  int64   `json:"disk_used"`
	Uptime    int64   `json:"uptime"`

	CPUModel       string          `json:"cpu_model"`
	GPU            string          `json:"gpu"`
	Disks          json.RawMessage `json:"disks"`
	Interfaces     json.RawMessage `json:"interfaces"`
	Security       json.RawMessage `json:"security"`
	RemoteSoftware json.RawMessage `json:"remote_software"`
	Battery        json.RawMessage `json:"battery"`
	UpdateStatus   json.RawMessage `json:"update_status"`

	// Links vem só do agente que é sonda de links de internet (ver links.go).
	Links *AmostraDeLinks `json:"links,omitempty"`

	// RecebidaEm é o momento em que a API aceitou o heartbeat. Vem dela, e
	// não do relógio deste servidor, para o "visto por último" não depender
	// de quanto o repasse demorou.
	RecebidaEm time.Time `json:"recebida_em"`
}

var errAmostraInvalida = errors.New("amostra inválida")

// Validar recusa o que não dá para gravar. Não tenta corrigir nada: quem
// monta a amostra é a API do Orion, e um campo ausente aqui é bug de lá.
func (a *Amostra) Validar() error {
	if strings.TrimSpace(a.MachineID) == "" || strings.TrimSpace(a.CompanyID) == "" {
		return errors.Join(errAmostraInvalida, errors.New("machine_id e company_id são obrigatórios"))
	}
	if strings.TrimSpace(a.Hostname) == "" {
		return errors.Join(errAmostraInvalida, errors.New("hostname é obrigatório"))
	}
	if a.RecebidaEm.IsZero() {
		return errors.Join(errAmostraInvalida, errors.New("recebida_em é obrigatório"))
	}
	if a.CPUUsage < 0 || a.RAMTotal < 0 || a.RAMUsed < 0 || a.DiskTotal < 0 || a.DiskUsed < 0 || a.Uptime < 0 {
		return errors.Join(errAmostraInvalida, errors.New("métricas não podem ser negativas"))
	}
	return nil
}

// Percentuais usados pelas métricas e pelos alertas. -1 quando o total não
// foi informado: o Prometheus não recebe a série, em vez de receber um zero
// que pareceria "disco vazio".
func (a *Amostra) RAMPct() float64  { return percentual(a.RAMUsed, a.RAMTotal) }
func (a *Amostra) DiskPct() float64 { return percentual(a.DiskUsed, a.DiskTotal) }

func percentual(usado, total int64) float64 {
	if total <= 0 {
		return -1
	}
	return float64(usado) / float64(total) * 100
}
