package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"orion-api/lib"
	"orion-api/monitor"
)

// Leitura do monitoramento no Orion Monitor — fase 2 da separação.
//
// O cadastro das máquinas (quem é, de que empresa, se foi aprovada) continua
// vindo do Supabase, que é a fonte da verdade do Orion. O "ao vivo" (CPU,
// memória, disco, última vez vista, inventário, alertas e gráfico) passa a
// vir do Monitor.
//
// Nesta fase o Supabase ainda recebe tudo em paralelo, então qualquer falha
// do Monitor cai de volta no dado de lá sem o usuário perceber. O cabeçalho
// X-Fonte-Monitoramento diz de onde veio cada resposta, para validar.

const timeoutLeituraMonitor = 3 * time.Second

var clienteLeituraMonitor = &http.Client{Timeout: timeoutLeituraMonitor}

var errMonitorDesligado = errors.New("monitor não configurado")

func monitorConfigurado() bool {
	return strings.TrimSpace(cfg.MonitorIngestURL) != "" && cfg.MonitorIngestSecret != ""
}

func marcarFonte(w http.ResponseWriter, fonte string) {
	w.Header().Set("X-Fonte-Monitoramento", fonte)
}

func pedirAoMonitor(ctx context.Context, metodo, caminho string, corpo any, destino any) error {
	if !monitorConfigurado() {
		return errMonitorDesligado
	}
	var leitor *bytes.Reader
	if corpo != nil {
		b, err := json.Marshal(corpo)
		if err != nil {
			return err
		}
		leitor = bytes.NewReader(b)
	} else {
		leitor = bytes.NewReader(nil)
	}
	ctx, cancel := context.WithTimeout(ctx, timeoutLeituraMonitor)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, metodo, strings.TrimSuffix(cfg.MonitorIngestURL, "/")+caminho, leitor)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.MonitorIngestSecret)
	if corpo != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := clienteLeituraMonitor.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return monitor.ErrNaoEncontrado
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("monitor respondeu %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(destino)
}

// sobreporEstadoDoMonitor troca, em cada máquina da listagem, os dados ao
// vivo pelos do Monitor. Máquina que o Monitor ainda não conhece fica como
// veio do Supabase. Devolve a fonte usada, para o cabeçalho.
func sobreporEstadoDoMonitor(ctx context.Context, maquinas []lib.MachineWithMetric) string {
	if len(maquinas) == 0 || !monitorConfigurado() {
		return "supabase"
	}
	ids := make([]string, len(maquinas))
	for i := range maquinas {
		ids[i] = maquinas[i].ID
	}
	var estados []monitor.Estado
	if err := pedirAoMonitor(ctx, http.MethodPost, "/v1/estado", map[string]any{"machine_ids": ids}, &estados); err != nil {
		return "supabase (monitor indisponível)"
	}
	porID := make(map[string]monitor.Estado, len(estados))
	for _, e := range estados {
		porID[e.MachineID] = e
	}
	for i := range maquinas {
		e, ok := porID[maquinas[i].ID]
		if !ok {
			continue
		}
		aplicarEstado(&maquinas[i], e)
	}
	return "monitor"
}

func aplicarEstado(m *lib.MachineWithMetric, e monitor.Estado) {
	cpu, ramT, ramU, diskT, diskU, up := e.CPUUsage, e.RAMTotal, e.RAMUsed, e.DiskTotal, e.DiskUsed, e.Uptime
	visto := e.VistoEm
	m.CPUUsage, m.RAMTotal, m.RAMUsed, m.DiskTotal, m.DiskUsed, m.Uptime = &cpu, &ramT, &ramU, &diskT, &diskU, &up
	m.CollectedAt = &visto
	// last_seen só avança: durante a transição o Supabase também grava, e o
	// mais recente dos dois é o que vale.
	if m.LastSeen == nil || visto.After(*m.LastSeen) {
		m.LastSeen = &visto
	}
	if len(e.SecurityInfo) > 0 && string(e.SecurityInfo) != "null" {
		sec := json.RawMessage(e.SecurityInfo)
		m.SecurityInfo = &sec
	}
}

func hardwareDoMonitor(ctx context.Context, id string) (*lib.HardwareRow, error) {
	var h monitor.Hardware
	if err := pedirAoMonitor(ctx, http.MethodGet, "/v1/maquinas/"+url.PathEscape(id)+"/hardware", nil, &h); err != nil {
		return nil, err
	}
	opcional := func(r json.RawMessage) *json.RawMessage {
		if len(r) == 0 || string(r) == "null" {
			return nil
		}
		c := r
		return &c
	}
	cpu, gpu := h.CPUModel, h.GPU
	return &lib.HardwareRow{
		MachineID: h.MachineID, CPUModel: &cpu, GPU: &gpu,
		RAMSlots: json.RawMessage("null"), Disks: h.Disks, NetworkInterfaces: h.Interfaces,
		SecurityInfo: opcional(h.SecurityInfo), RemoteSoftware: opcional(h.RemoteSoftware),
		BatteryInfo: opcional(h.BatteryInfo), UpdateStatus: opcional(h.UpdateStatus),
		UpdatedAt: h.AtualizadoEm,
	}, nil
}

func alertasDoMonitor(ctx context.Context, id string) ([]lib.AlertRow, error) {
	var alertas []monitor.AlertaAberto
	if err := pedirAoMonitor(ctx, http.MethodGet, "/v1/maquinas/"+url.PathEscape(id)+"/alertas", nil, &alertas); err != nil {
		return nil, err
	}
	out := make([]lib.AlertRow, 0, len(alertas))
	for _, a := range alertas {
		out = append(out, lib.AlertRow{
			ID: strconv.FormatInt(a.ID, 10), MachineID: a.MachineID, Type: a.Tipo,
			Severity: a.Severidade, Message: a.Mensagem, Resolved: false, CreatedAt: a.AbertoEm,
		})
	}
	return out, nil
}

func historicoDoMonitor(ctx context.Context, id string, janela, passo time.Duration) ([]lib.MetricRow, error) {
	var pontos []monitor.PontoHistorico
	caminho := fmt.Sprintf("/v1/maquinas/%s/historico?janela=%d&passo=%d", url.PathEscape(id), int(janela.Seconds()), int(passo.Seconds()))
	if err := pedirAoMonitor(ctx, http.MethodGet, caminho, nil, &pontos); err != nil {
		return nil, err
	}
	pct := func(v *float64) *int16 {
		if v == nil {
			return nil
		}
		p := int16(math.Round(math.Max(0, math.Min(100, *v))))
		return &p
	}
	out := make([]lib.MetricRow, 0, len(pontos))
	for _, p := range pontos {
		out = append(out, lib.MetricRow{MachineID: id, CPUUsage: p.CPU, RAMPct: pct(p.RAM), DiskPct: pct(p.Disk), CollectedAt: p.Em})
	}
	return out, nil
}

// historicoCobreJanela diz se o ponto mais antigo da série alcança o começo da
// janela, com tolerância de 20 minutos — o intervalo em que uma estação de
// trabalho pode ficar sem ponto (heartbeat de 5 min, mais atraso de coleta).
// Os pontos chegam do mais recente para o mais antigo.
func historicoCobreJanela(pontos []lib.MetricRow, janela time.Duration, agora time.Time) bool {
	if len(pontos) == 0 {
		return false
	}
	maisAntigo := pontos[len(pontos)-1].CollectedAt
	return !maisAntigo.After(agora.Add(-janela).Add(20 * time.Minute))
}
