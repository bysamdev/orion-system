package handler

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"orion-api/lib"
)

type createEndpointReq struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	CompanyID string `json:"company_id,omitempty"`
}

// endpointDiagnostics carrega as métricas reais de uptime/latência exibidas
// no painel de diagnóstico expandido de cada monitor no front — substitui os
// números que antes eram fabricados a partir só do status atual (isOnline),
// o que fazia o histórico "resetar" pra 100% assim que o site voltava a
// ficar online.
//
// Fonte: Prometheus (blackbox_exporter), consultado via proxy do Grafana —
// o mesmo Prometheus que já roda no servidor de monitoramento (Debian,
// docker-compose em ~/monitoramento) e que o orion-bridge usa pra manter
// monitored_endpoints.status em dia (ver monitoring/bridge.mjs e
// monitoring/prometheus.yml, job "blackbox_http", label endpoint_id). Não
// usa a API do UptimeRobot: aquele monitor é de terceiro, com resolução
// diferente do que o próprio servidor de monitoramento já mede.
type endpointDiagnostics struct {
	Uptime24hPct     *float64          `json:"uptime_24h_pct"`
	ResponseMinMs    *int              `json:"response_min_ms"`
	ResponseAvgMs    *int              `json:"response_avg_ms"`
	ResponseMaxMs    *int              `json:"response_max_ms"`
	JitterMs         *int              `json:"jitter_ms"`
	DowntimeEvents24 int               `json:"downtime_events_24h"`
	RecentChecks     []recentCheckJSON `json:"recent_checks"`
	RecentEvents     []recentEventJSON `json:"recent_events"`
	HasDiagnostics   bool              `json:"has_diagnostics"`
}

type recentCheckJSON struct {
	Time int64 `json:"time"` // unix seconds
	Ms   int   `json:"ms"`
}

type recentEventJSON struct {
	Type     int   `json:"type"` // 1=down, 2=up
	Time     int64 `json:"time"` // unix seconds
	Duration int   `json:"duration"`
}

// buildEndpointDiagnostics recebe as séries brutas de probe_success (0/1) e
// probe_duration_seconds*1000 (ms) devolvidas pelo Prometheus (mesmo
// timestamp unix como chave nos dois mapas) e calcula uptime real,
// latência min/média/máx, jitter e os eventos de queda das últimas 24h.
func buildEndpointDiagnostics(success, durationMs map[int64]float64) endpointDiagnostics {
	diag := endpointDiagnostics{HasDiagnostics: true}
	if len(success) == 0 {
		return diag
	}

	timestamps := make([]int64, 0, len(success))
	for ts := range success {
		timestamps = append(timestamps, ts)
	}
	sort.Slice(timestamps, func(i, j int) bool { return timestamps[i] < timestamps[j] })

	upCount := 0
	for _, ts := range timestamps {
		if success[ts] == 1 {
			upCount++
		}
	}
	uptime := (float64(upCount) / float64(len(timestamps))) * 100
	diag.Uptime24hPct = &uptime

	// Latência só faz sentido para pontos em que o probe teve sucesso —
	// quando falha, probe_duration_seconds mede o tempo até o timeout, não
	// uma resposta real do servidor.
	var okValues []int
	for _, ts := range timestamps {
		if success[ts] != 1 {
			continue
		}
		if v, ok := durationMs[ts]; ok {
			okValues = append(okValues, int(math.Round(v)))
		}
	}
	if len(okValues) > 0 {
		sum, minV, maxV := 0, okValues[0], okValues[0]
		for _, v := range okValues {
			sum += v
			if v < minV {
				minV = v
			}
			if v > maxV {
				maxV = v
			}
		}
		avg := sum / len(okValues)
		var variance float64
		for _, v := range okValues {
			d := float64(v - avg)
			variance += d * d
		}
		variance /= float64(len(okValues))
		jitter := int(math.Round(math.Sqrt(variance)))

		diag.ResponseMinMs = &minV
		diag.ResponseAvgMs = &avg
		diag.ResponseMaxMs = &maxV
		diag.JitterMs = &jitter

		// Sondas mais recentes primeiro, pra alimentar a barra de
		// "verificações contínuas" e o log de checagens no front.
		type check struct {
			ts int64
			ms int
		}
		var checks []check
		for _, ts := range timestamps {
			if success[ts] != 1 {
				continue
			}
			if v, ok := durationMs[ts]; ok {
				checks = append(checks, check{ts, int(math.Round(v))})
			}
		}
		sort.Slice(checks, func(i, j int) bool { return checks[i].ts > checks[j].ts })
		limit := 24
		if len(checks) < limit {
			limit = len(checks)
		}
		diag.RecentChecks = make([]recentCheckJSON, limit)
		for i := 0; i < limit; i++ {
			diag.RecentChecks[i] = recentCheckJSON{Time: checks[i].ts, Ms: checks[i].ms}
		}
	}

	// Eventos de queda: cada transição 1→0 (ou início da janela já em 0)
	// abre um evento; a transição seguinte pra 1 (ou o fim da janela, se a
	// queda ainda está em andamento) fecha ele.
	var events []recentEventJSON
	var downStart int64 = 0
	wasDown := false
	for _, ts := range timestamps {
		isDown := success[ts] != 1
		if isDown && !wasDown {
			downStart = ts
		} else if !isDown && wasDown {
			events = append(events, recentEventJSON{Type: 1, Time: downStart, Duration: int(ts - downStart)})
		}
		wasDown = isDown
	}
	if wasDown {
		lastTs := timestamps[len(timestamps)-1]
		events = append(events, recentEventJSON{Type: 1, Time: downStart, Duration: int(lastTs - downStart)})
	}
	diag.DowntimeEvents24 = len(events)

	sort.Slice(events, func(i, j int) bool { return events[i].Time > events[j].Time })
	limit := 5
	if len(events) < limit {
		limit = len(events)
	}
	diag.RecentEvents = events[:limit]

	return diag
}

func monitoringCreateWebEndpoint(w http.ResponseWriter, r *http.Request) {
	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	escopo, err := escopoDoUsuario(r.Context(), user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		http.Error(w, "Acesso restrito: apenas administradores e técnicos podem gerenciar monitoramento web", http.StatusForbidden)
		return
	}

	var req createEndpointReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Resolução de escopo idêntica ao molde de network_links_handlers.go:87.
	// Equipe interna (Global) pode criar em qualquer empresa; os demais ficam
	// fixados na própria empresa.
	var targetCompanyID string
	if escopo.Global() {
		if req.CompanyID != "" {
			targetCompanyID = req.CompanyID
		} else if escopo.CompanyID != nil {
			targetCompanyID = *escopo.CompanyID
		}
	} else if escopo.CompanyID != nil {
		targetCompanyID = *escopo.CompanyID
	}
	if targetCompanyID == "" {
		http.Error(w, "Company not found", http.StatusBadRequest)
		return
	}

	// O status do site vem do Blackbox (Prometheus), via orion-bridge; a
	// integração com o UptimeRobot foi removida (ORN-DUP-04): nunca chegou a
	// criar monitor e disputava com o Blackbox quem gravava o status.
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		req.URL = "https://" + req.URL
	}

	_, err = db.Pool().Exec(r.Context(), `
		INSERT INTO public.monitored_endpoints (company_id, name, url_or_ip, status, created_at)
		VALUES ($1, $2, $3, 'pending', now())
	`, targetCompanyID, req.Name, req.URL)

	if err != nil {
		http.Error(w, "Failed to save to database", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

type MonitoredEndpoint struct {
	ID        string     `json:"id"`
	CompanyID string     `json:"company_id"`
	Name      string     `json:"name"`
	URLOrIP   string     `json:"url_or_ip"`
	Status    string     `json:"status"` // e.g. "pending", "online", "offline", "paused"
	LastCheck *time.Time `json:"last_check"`
	CreatedAt time.Time  `json:"created_at"`
}

// statusComFrescor devolve 'sem_dados' quando o status do site não é
// confirmado há mais de 15 minutos.
//
// Quem grava o status é o orion-bridge, no servidor de monitoramento. Com o
// servidor desligado, a coluna congelava no último valor e o painel seguia
// mostrando "online" sem saber de nada (auditoria de monitoramento de
// 18/09/2026, P3). A RPC update_telemetry_status renova last_check pelo menos
// a cada 5 minutos enquanto o bridge roda, então 15 minutos sem renovação
// significam três ciclos perdidos: o dado parou de chegar.
//
// 'pending' e 'paused' passam intactos — nesses o status não afirma nada
// sobre o site.
const statusComFrescor = `CASE
				WHEN status IN ('online', 'offline')
				 AND (last_check IS NULL OR last_check < now() - interval '15 minutes')
				THEN 'sem_dados'
				ELSE status
			END`

func monitoringListWebEndpoints(w http.ResponseWriter, r *http.Request) {
	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Resolução de escopo idêntica ao molde de network_links_handlers.go:32.
	// Equipe interna (Global) pode filtrar por company_id via query string;
	// os demais ficam fixados na própria empresa.
	escopo, err := escopoDoUsuario(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "Não foi possível resolver sua empresa", http.StatusInternalServerError)
		return
	}
	var companyID string
	if escopo.Global() {
		companyID = r.URL.Query().Get("company_id")
	} else if escopo.CompanyID != nil {
		companyID = *escopo.CompanyID
	} else {
		http.Error(w, "Não foi possível resolver sua empresa", http.StatusForbidden)
		return
	}

	// 1. Fetch from DB
	var (
		sqlStr string
		args   []any
	)
	if companyID != "" {
		sqlStr = `
			SELECT id, name, url_or_ip, ` + statusComFrescor + `
			FROM public.monitored_endpoints
			WHERE company_id = $1
			ORDER BY created_at DESC
		`
		args = append(args, companyID)
	} else {
		sqlStr = `
			SELECT id, name, url_or_ip, ` + statusComFrescor + `
			FROM public.monitored_endpoints
			ORDER BY created_at DESC
		`
	}
	rows, err := db.Pool().Query(r.Context(), sqlStr, args...)
	if err != nil {
		http.Error(w, "Failed to query endpoints", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var endpoints []map[string]interface{}
	for rows.Next() {
		var id, name, urlOrIp, status string
		if err := rows.Scan(&id, &name, &urlOrIp, &status); err != nil {
			continue
		}
		endpoints = append(endpoints, map[string]interface{}{
			"id":        id,
			"name":      name,
			"url_or_ip": urlOrIp,
			"status":    status,
		})
	}

	// 2. Diagnóstico real (uptime, latência, quedas) vem do Prometheus do
	// próprio servidor de monitoramento, via proxy do Grafana — o mesmo
	// dado que já alimenta o status ao vivo através do orion-bridge (ver
	// comentário de endpointDiagnostics acima). Sem GRAFANA_API_TOKEN
	// configurado ou sem série no Prometheus pra esse endpoint_id (ex:
	// monitor criado há poucos segundos), fica has_diagnostics=false — o
	// front mostra "sem dados" em vez de inventar número.
	//
	// Em paralelo (não sequencial): cada endpoint dispara 2 chamadas HTTP
	// pro Grafana (probe_success + probe_duration_seconds), e o número de
	// monitores por empresa é sempre pequeno o bastante pra não precisar de
	// um limite de concorrência (diferente da frota de máquinas).
	diagnosticsByIndex := make([]endpointDiagnostics, len(endpoints))
	var wg sync.WaitGroup
	for i, ep := range endpoints {
		i, id := i, ep["id"].(string)
		wg.Add(1)
		go func() {
			defer wg.Done()
			success, durationMs, err := lib.QueryWebEndpointProbeSeries(
				r.Context(), cfg.GrafanaURL, cfg.GrafanaAPIToken, cfg.GrafanaPromDSUID, cfg.GrafanaBypassSecret, id,
			)
			if err != nil {
				diagnosticsByIndex[i] = endpointDiagnostics{HasDiagnostics: false}
				return
			}
			diagnosticsByIndex[i] = buildEndpointDiagnostics(success, durationMs)
		}()
	}
	wg.Wait()
	for i := range endpoints {
		endpoints[i]["diagnostics"] = diagnosticsByIndex[i]
	}

	if endpoints == nil {
		endpoints = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(endpoints)
}

func monitoringDeleteWebEndpoint(w http.ResponseWriter, r *http.Request) {
	user, err := requireAuth(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	escopo, err := escopoDoUsuario(r.Context(), user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		http.Error(w, "Acesso restrito: apenas administradores e técnicos podem gerenciar monitoramento web", http.StatusForbidden)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "ID required", http.StatusBadRequest)
		return
	}

	// Resolução de escopo idêntica ao molde de network_links_handlers.go:142.
	// Equipe interna pode excluir endpoint de qualquer empresa (sem filtrar
	// por company_id); os demais só apagam da própria empresa.
	if !escopo.Global() && escopo.CompanyID == nil {
		http.Error(w, "Não foi possível resolver sua empresa", http.StatusForbidden)
		return
	}

	var tag interface{ RowsAffected() int64 }
	if escopo.Global() {
		tag, err = db.Pool().Exec(r.Context(), `
			DELETE FROM public.monitored_endpoints WHERE id = $1
		`, id)
	} else {
		tag, err = db.Pool().Exec(r.Context(), `
			DELETE FROM public.monitored_endpoints WHERE id = $1 AND company_id = $2
		`, id, *escopo.CompanyID)
	}

	if err != nil {
		http.Error(w, "Failed to delete from DB", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "Endpoint not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
