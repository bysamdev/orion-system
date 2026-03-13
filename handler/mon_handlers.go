package handler

// mon_handlers.go — handlers for /api/monitoring/* endpoints.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

func monitoringDashboard(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	s, err := db.DashboardSummaryData(r.Context())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar dashboard"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"total": s.Total, "online": s.Online, "offline": s.Offline, "active_alerts": s.ActiveAlerts,
	})
}

func monitoringListGroups(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	groups, err := db.ListMachineGroups(r.Context())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar grupos"})
		return
	}
	type out struct {
		ID             string  `json:"id"`
		Name           string  `json:"name"`
		Description    *string `json:"description"`
		ClientContact  *string `json:"client_contact"`
		TotalMachines  int     `json:"total_machines"`
		OnlineMachines int     `json:"online_machines"`
	}
	res := make([]out, 0, len(groups))
	for _, g := range groups {
		res = append(res, out{ID: g.ID, Name: g.Name, Description: g.Description,
			ClientContact: g.ClientContact, TotalMachines: g.TotalMachines, OnlineMachines: g.OnlineMachines})
	}
	lib.WriteJSON(w, http.StatusOK, res)
}

func monitoringGroupMachines(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	groupID := chi.URLParam(r, "id")
	machines, err := db.MachinesByGroupID(r.Context(), groupID)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar máquinas"})
		return
	}
	if machines == nil {
		machines = []lib.MachineWithMetric{}
	}
	lib.WriteJSON(w, http.StatusOK, machines)
}

func monitoringMachineDetail(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	id := chi.URLParam(r, "id")
	machine, err := db.MachineByID(r.Context(), id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}
	hw, _ := db.MachineHardwareByMachineID(r.Context(), id)
	lib.WriteJSON(w, http.StatusOK, map[string]any{"machine": machine, "hardware": hw})
}

func monitoringMachineMetrics(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	id := chi.URLParam(r, "id")
	limit := 100
	if ls := r.URL.Query().Get("limit"); ls != "" {
		if l, err := strconv.Atoi(ls); err == nil && l > 0 {
			limit = l
		}
	}
	metrics, err := db.MetricsByMachineID(r.Context(), id, limit)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar métricas"})
		return
	}
	if metrics == nil {
		metrics = []lib.MetricRow{}
	}
	lib.WriteJSON(w, http.StatusOK, metrics)
}

func monitoringMachineAlerts(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	id := chi.URLParam(r, "id")
	alerts, err := db.AlertsByMachineID(r.Context(), id)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar alertas"})
		return
	}
	if alerts == nil {
		alerts = []lib.AlertRow{}
	}
	lib.WriteJSON(w, http.StatusOK, alerts)
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

type heartbeatReq struct {
	AgentKey     string          `json:"agent_key"`
	Hostname     string          `json:"hostname"`
	IP           string          `json:"ip"`
	OS           string          `json:"os"`
	OSVersion    string          `json:"os_version"`
	AgentVersion string          `json:"agent_version"`
	CPUUsage     float64         `json:"cpu_usage"`
	RAMTotal     int64           `json:"ram_total"`
	RAMUsed      int64           `json:"ram_used"`
	DiskTotal    int64           `json:"disk_total"`
	DiskUsed     int64           `json:"disk_used"`
	Uptime       int64           `json:"uptime"`
	CPUModel     string          `json:"cpu_model"`
	GPU          string          `json:"gpu"`
	Disks        json.RawMessage `json:"disks"`
	Domain       string          `json:"domain"`
}

func monitoringHeartbeat(w http.ResponseWriter, r *http.Request) {
	// Agent key can come via header OR JSON field – check header first
	agentKeyHeader := r.Header.Get("X-Agent-Key")

	var req heartbeatReq
	if err := lib.DecodeLenient(r, &req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido: " + err.Error()})
		return
	}

	if db == nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Conexão com o banco de dados não inicializada no Vercel (verifique as credenciais no .env / Vercel)"})
		return
	}

	key := agentKeyHeader
	if key == "" {
		key = req.AgentKey
	}
	if err := lib.RequireAgentKey(&http.Request{Header: http.Header{"X-Agent-Key": {key}}}, cfg.AgentKey); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	if req.Hostname == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "hostname é obrigatório"})
		return
	}

	ctx := r.Context()

	// Tratamento do Domínio via GetOrCreateMachineGroup
	domain := req.Domain
	if domain == "" {
		domain = "WORKGROUP"
	}
	groupID, err := db.GetOrCreateMachineGroup(ctx, domain)
	if err != nil {
		fmt.Println("Erro GetOrCreateMachineGroup:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar grupo de máquina: %v", err)})
		return
	}

	machineID, err := db.UpsertMachine(ctx, groupID, req.Hostname, req.IP, req.OS, req.OSVersion, req.AgentVersion)
	if err != nil {
		fmt.Println("Erro UpsertMachine:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar máquina: %v", err)})
		return
	}

	if err := db.InsertMetric(ctx, lib.InsertMetricInput{
		MachineID: machineID, CPUUsage: req.CPUUsage,
		RAMTotal: req.RAMTotal, RAMUsed: req.RAMUsed,
		DiskTotal: req.DiskTotal, DiskUsed: req.DiskUsed, Uptime: req.Uptime,
	}); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao salvar métricas: %v", err)})
		return
	}

	disksJSON := req.Disks
	if len(disksJSON) == 0 {
		disksJSON = json.RawMessage(`[]`)
	}
	_ = db.UpsertHardware(ctx, lib.UpsertHardwareInput{
		MachineID: machineID, CPUModel: req.CPUModel,
		RAMSlots: []byte(`null`), Disks: disksJSON, GPU: req.GPU,
	})

	if req.DiskTotal > 0 {
		usage := float64(req.DiskUsed) / float64(req.DiskTotal)
		if usage > 0.90 {
			_ = db.InsertAlert(ctx, lib.InsertAlertInput{
				MachineID: machineID, Type: "disk_usage", Severity: "critical",
				Message: fmt.Sprintf("Uso de disco crítico: %.1f%% (%d/%d bytes)", usage*100, req.DiskUsed, req.DiskTotal),
			})
		}
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "machine_id": machineID})
}
