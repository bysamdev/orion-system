package lib

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

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

// webEndpointProbeCacheTTL amortiza reaberturas da tela de Monitoramento Web
// (refetch de 15s do frontend, várias abas abertas) sem bater no Grafana toda
// vez — cada carregamento da lista já dispara 2 consultas de range por
// endpoint monitorado.
const webEndpointProbeCacheTTL = 30 * time.Second

type webEndpointProbeCacheEntry struct {
	success    map[int64]float64
	durationMs map[int64]float64
	expiresAt  time.Time
}

var (
	webEndpointProbeCacheMu sync.Mutex
	webEndpointProbeCache   = map[string]webEndpointProbeCacheEntry{}
)

// QueryWebEndpointProbeSeries busca, para um monitor de public.monitored_endpoints,
// as séries brutas das últimas 24h de probe_success (0/1) e
// probe_duration_seconds convertido pra ms — exatamente as métricas que o
// blackbox_exporter do servidor de monitoramento já produz e que
// monitoring/bridge.mjs usa pra manter monitored_endpoints.status em dia
// (ver monitoring/prometheus.yml, job "blackbox_http", label endpoint_id
// vindo de monitoring/bridge.mjs). Não fala com nenhuma API de terceiro
// (UptimeRobot etc.) — é o mesmo Prometheus, consultado via proxy do
// Grafana: o Prometheus do servidor Debian só escuta em 127.0.0.1, e o
// Grafana (com o mesmo datasource dos dashboards) é o único caminho
// alcançável de fora.
func QueryWebEndpointProbeSeries(ctx context.Context, grafanaURL, apiToken, datasourceUID, bypassSecret, endpointID string) (success map[int64]float64, durationMs map[int64]float64, err error) {
	if !isSafePromLabelValue(endpointID) {
		return nil, nil, fmt.Errorf("endpoint_id inválido")
	}
	if apiToken == "" {
		return nil, nil, fmt.Errorf("GRAFANA_API_TOKEN não configurado")
	}

	now := time.Now()
	cacheKey := endpointID

	webEndpointProbeCacheMu.Lock()
	if entry, ok := webEndpointProbeCache[cacheKey]; ok && now.Before(entry.expiresAt) {
		webEndpointProbeCacheMu.Unlock()
		return entry.success, entry.durationMs, nil
	}
	webEndpointProbeCacheMu.Unlock()

	start := now.Add(-24 * time.Hour)
	sel := fmt.Sprintf(`{endpoint_id="%s"}`, endpointID)

	success, err = queryPrometheusRange(ctx, grafanaURL, apiToken, datasourceUID, bypassSecret, "probe_success"+sel, start, now, time.Minute)
	if err != nil {
		return nil, nil, fmt.Errorf("consultar probe_success: %w", err)
	}
	durationMs, err = queryPrometheusRange(ctx, grafanaURL, apiToken, datasourceUID, bypassSecret, "probe_duration_seconds"+sel+" * 1000", start, now, time.Minute)
	if err != nil {
		return nil, nil, fmt.Errorf("consultar probe_duration_seconds: %w", err)
	}

	webEndpointProbeCacheMu.Lock()
	webEndpointProbeCache[cacheKey] = webEndpointProbeCacheEntry{success: success, durationMs: durationMs, expiresAt: now.Add(webEndpointProbeCacheTTL)}
	webEndpointProbeCacheMu.Unlock()

	return success, durationMs, nil
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
