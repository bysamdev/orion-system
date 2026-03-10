package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"orion-system-backend/internal/db"
)

// ============================================================
// GET /api/monitoring/groups
// ============================================================

func (h *Handler) MonitoringListGroups(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	groups, err := h.db.ListMachineGroups(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar grupos"})
		return
	}

	type groupOut struct {
		ID             string  `json:"id"`
		Name           string  `json:"name"`
		Description    *string `json:"description"`
		ClientContact  *string `json:"client_contact"`
		TotalMachines  int     `json:"total_machines"`
		OnlineMachines int     `json:"online_machines"`
	}

	out := make([]groupOut, 0, len(groups))
	for _, g := range groups {
		out = append(out, groupOut{
			ID:             g.ID,
			Name:           g.Name,
			Description:    g.Description,
			ClientContact:  g.ClientContact,
			TotalMachines:  g.TotalMachines,
			OnlineMachines: g.OnlineMachines,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// ============================================================
// GET /api/monitoring/groups/{id}/machines
// ============================================================

func (h *Handler) MonitoringGroupMachines(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	groupID := chi.URLParam(r, "id")
	if groupID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "id do grupo é obrigatório"})
		return
	}

	machines, err := h.db.MachinesByGroupID(r.Context(), groupID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar máquinas do grupo"})
		return
	}

	writeJSON(w, http.StatusOK, machines)
}

// ============================================================
// GET /api/monitoring/machines/{id}
// ============================================================

func (h *Handler) MonitoringMachineDetail(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	machine, err := h.db.MachineByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}

	hw, _ := h.db.MachineHardwareByMachineID(r.Context(), id) // optional — tolera ausência

	writeJSON(w, http.StatusOK, map[string]any{
		"machine":  machine,
		"hardware": hw,
	})
}

// ============================================================
// GET /api/monitoring/machines/{id}/metrics?limit=100
// ============================================================

func (h *Handler) MonitoringMachineMetrics(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	limit := 100
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	metrics, err := h.db.MetricsByMachineID(r.Context(), id, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar métricas"})
		return
	}
	if metrics == nil {
		metrics = []db.MetricRow{}
	}
	writeJSON(w, http.StatusOK, metrics)
}

// ============================================================
// GET /api/monitoring/machines/{id}/alerts
// ============================================================

func (h *Handler) MonitoringMachineAlerts(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	alerts, err := h.db.AlertsByMachineID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar alertas"})
		return
	}
	if alerts == nil {
		alerts = []db.AlertRow{}
	}
	writeJSON(w, http.StatusOK, alerts)
}

// ============================================================
// POST /api/monitoring/machines/heartbeat
// Autenticação: header X-Agent-Key
// ============================================================

type HeartbeatRequest struct {
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
}

func (h *Handler) MonitoringHeartbeat(w http.ResponseWriter, r *http.Request) {
	// 1. Validar chave do agente (aceita via header OU campo JSON)
	agentKey := r.Header.Get("X-Agent-Key")

	var req HeartbeatRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido: " + err.Error()})
		return
	}

	// Fallback: se não veio no header, tenta o campo JSON
	if agentKey == "" {
		agentKey = req.AgentKey
	}

	expectedKey := h.cfg.AgentKey
	if expectedKey == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Servidor sem AGENT_KEY configurado"})
		return
	}
	if agentKey != expectedKey {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Chave de agente inválida"})
		return
	}

	if req.Hostname == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "hostname é obrigatório"})
		return
	}

	ctx := r.Context()

	// 2. Upsert da máquina
	machineID, err := h.db.UpsertMachine(ctx, req.Hostname, req.IP, req.OS, req.OSVersion, req.AgentVersion)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar máquina: %v", err)})
		return
	}

	// 3. Inserir snapshot de métricas
	if err := h.db.InsertMetric(ctx, db.InsertMetricInput{
		MachineID: machineID,
		CPUUsage:  req.CPUUsage,
		RAMTotal:  req.RAMTotal,
		RAMUsed:   req.RAMUsed,
		DiskTotal: req.DiskTotal,
		DiskUsed:  req.DiskUsed,
		Uptime:    req.Uptime,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao salvar métricas: %v", err)})
		return
	}

	// 4. Upsert de hardware (opcional — tolera campos vazios)
	disksJSON := req.Disks
	if len(disksJSON) == 0 {
		disksJSON = json.RawMessage(`[]`)
	}
	_ = h.db.UpsertHardware(ctx, db.UpsertHardwareInput{
		MachineID: machineID,
		CPUModel:  req.CPUModel,
		RAMSlots:  []byte(`null`),
		Disks:     disksJSON,
		GPU:       req.GPU,
	})

	// 5. Alerta automático: disco > 90 %
	if req.DiskTotal > 0 {
		usage := float64(req.DiskUsed) / float64(req.DiskTotal)
		if usage > 0.90 {
			_ = h.db.InsertAlert(ctx, db.InsertAlertInput{
				MachineID: machineID,
				Type:      "disk_usage",
				Severity:  "critical",
				Message:   fmt.Sprintf("Uso de disco crítico: %.1f%% (usado %d / total %d bytes)", usage*100, req.DiskUsed, req.DiskTotal),
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"machine_id": machineID,
	})
}

// ============================================================
// GET /api/monitoring/dashboard
// ============================================================

func (h *Handler) MonitoringDashboard(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	s, err := h.db.DashboardSummaryData(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar resumo do dashboard"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total":         s.Total,
		"online":        s.Online,
		"offline":       s.Offline,
		"active_alerts": s.ActiveAlerts,
	})
}
