package lib

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"
)

// periodWindow traduz o período pedido pelo frontend (mesmos valores de
// MetricPeriod em src/hooks/useMonitoring.ts) numa janela de tempo e passo
// de amostragem do Prometheus. Períodos maiores usam passo mais largo —
// não faria sentido pedir 7 dias em resolução de 1 minuto (>10k pontos por
// série, 5 séries por máquina).
func periodWindow(period string, now time.Time) (start, end time.Time, step time.Duration) {
	end = now
	switch period {
	case "6h":
		return end.Add(-6 * time.Hour), end, time.Minute
	case "24h":
		return end.Add(-24 * time.Hour), end, 5 * time.Minute
	case "7d":
		return end.Add(-7 * 24 * time.Hour), end, 30 * time.Minute
	default: // "1h" e qualquer valor desconhecido
		return end.Add(-1 * time.Hour), end, time.Minute
	}
}

type promRangeResponse struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		Result []struct {
			Values [][2]json.RawMessage `json:"values"` // [timestamp, "valor como string"]
		} `json:"result"`
	} `json:"data"`
}

// queryPrometheusRange consulta uma métrica via proxy autenticado do
// Grafana (não fala com o Prometheus diretamente — ver ARCHITECTURE do
// backend: o Grafana já expõe essa API pronta, com o mesmo datasource que
// os dashboards usam, sem precisar abrir mais uma porta/túnel próprios).
// Retorna um mapa timestamp-unix -> valor, só do primeiro result series
// (as consultas usadas aqui são sempre por um único machine_id, que já
// identifica uma série só).
func queryPrometheusRange(ctx context.Context, grafanaURL, apiToken, datasourceUID, bypassSecret, promQuery string, start, end time.Time, step time.Duration) (map[int64]float64, error) {
	u := fmt.Sprintf("%s/api/datasources/proxy/uid/%s/api/v1/query_range", grafanaURL, datasourceUID)
	q := url.Values{}
	q.Set("query", promQuery)
	q.Set("start", strconv.FormatInt(start.Unix(), 10))
	q.Set("end", strconv.FormatInt(end.Unix(), 10))
	q.Set("step", strconv.FormatFloat(step.Seconds(), 'f', -1, 64))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)
	// Chamada servidor-servidor pro hostname público do Grafana (atrás do
	// Cloudflare) tem cara de bot pro Bot Fight Mode do Cloudflare e leva um
	// Managed Challenge (HTML, não JSON) em vez da resposta real. Esse
	// header casa com uma regra de WAF que pula esse desafio só pra quem
	// carrega o segredo — ver GRAFANA_BYPASS_SECRET.
	if bypassSecret != "" {
		req.Header.Set("X-Orion-Backend-Secret", bypassSecret)
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("chamada ao Grafana: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("ler resposta do Grafana: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Grafana respondeu %d: %s", resp.StatusCode, string(body))
	}

	var parsed promRangeResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decodificar resposta do Grafana: %w", err)
	}
	if parsed.Status != "success" {
		return nil, fmt.Errorf("Prometheus retornou erro: %s", parsed.Error)
	}

	out := map[int64]float64{}
	if len(parsed.Data.Result) == 0 {
		return out, nil
	}
	for _, pair := range parsed.Data.Result[0].Values {
		var ts float64
		if err := json.Unmarshal(pair[0], &ts); err != nil {
			continue
		}
		var valStr string
		if err := json.Unmarshal(pair[1], &valStr); err != nil {
			continue
		}
		val, err := strconv.ParseFloat(valStr, 64)
		if err != nil {
			continue
		}
		out[int64(ts)] = val
	}
	return out, nil
}

// escapeLabelValue evita quebrar a query PromQL se um machine_id (UUID,
// sempre) viesse com aspas — machine_id é sempre gerado por uuid_generate_v4()
// no banco, então isso nunca deveria disparar, mas a query é montada por
// concatenação de string, então validamos o formato mesmo assim.
func isSafePromLabelValue(v string) bool {
	for _, r := range v {
		if r == '"' || r == '\\' || r == '\n' || r == '\r' {
			return false
		}
	}
	return v != ""
}

// QueryMachineMetricsHistory busca o histórico de CPU/RAM/disco de uma
// máquina no Prometheus (via Grafana) e devolve no mesmo formato que
// MetricsByMachineID devolvia lendo de machine_metrics — troca só a fonte,
// mantém o contrato que o handler HTTP e o frontend já esperam.
func QueryMachineMetricsHistory(ctx context.Context, grafanaURL, apiToken, datasourceUID, bypassSecret, machineID, period string) ([]MetricRow, error) {
	if !isSafePromLabelValue(machineID) {
		return nil, fmt.Errorf("machine_id inválido")
	}
	if apiToken == "" {
		return nil, fmt.Errorf("GRAFANA_API_TOKEN não configurado")
	}

	start, end, step := periodWindow(period, time.Now())
	sel := fmt.Sprintf(`{machine_id="%s"}`, machineID)

	queries := map[string]string{
		"cpu":        "orion_cpu_usage_percent" + sel,
		"ram_used":   "orion_memory_used_bytes" + sel,
		"ram_total":  "orion_memory_total_bytes" + sel,
		"disk_used":  `orion_disk_used_bytes{machine_id="` + machineID + `",mount="root"}`,
		"disk_total": `orion_disk_total_bytes{machine_id="` + machineID + `",mount="root"}`,
	}

	results := map[string]map[int64]float64{}
	for name, q := range queries {
		r, err := queryPrometheusRange(ctx, grafanaURL, apiToken, datasourceUID, bypassSecret, q, start, end, step)
		if err != nil {
			return nil, fmt.Errorf("consultar %s: %w", name, err)
		}
		results[name] = r
	}

	// União de todos os timestamps vistos em qualquer uma das 5 séries —
	// cobre o caso raro de uma série faltar um ponto que outra tem.
	seen := map[int64]bool{}
	for _, r := range results {
		for ts := range r {
			seen[ts] = true
		}
	}

	out := make([]MetricRow, 0, len(seen))
	for ts := range seen {
		row := MetricRow{
			ID:          fmt.Sprintf("%s-%d", machineID, ts),
			MachineID:   machineID,
			CollectedAt: time.Unix(ts, 0).UTC(),
		}
		if v, ok := results["cpu"][ts]; ok {
			row.CPUUsage = &v
		}
		if v, ok := results["ram_used"][ts]; ok {
			i := int64(v)
			row.RAMUsed = &i
		}
		if v, ok := results["ram_total"][ts]; ok {
			i := int64(v)
			row.RAMTotal = &i
		}
		if v, ok := results["disk_used"][ts]; ok {
			i := int64(v)
			row.DiskUsed = &i
		}
		if v, ok := results["disk_total"][ts]; ok {
			i := int64(v)
			row.DiskTotal = &i
		}
		out = append(out, row)
	}

	// O frontend espera ordem mais recente -> mais antiga (mesmo contrato de
	// MetricsByMachineID, que usava ORDER BY collected_at DESC).
	sort.Slice(out, func(i, j int) bool { return out[i].CollectedAt.After(out[j].CollectedAt) })
	return out, nil
}
