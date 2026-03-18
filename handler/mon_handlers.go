package handler

// mon_handlers.go — handlers for /api/monitoring/* endpoints.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

func monitoringDashboard(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers dashboard auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	
	_ = user // keeping for future use
	s, err := db.DashboardSummaryData(ctx)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar dashboard"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"total": s.Total, "online": s.Online, "offline": s.Offline, "active_alerts": s.ActiveAlerts,
	})
}

func monitoringListGroups(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers groups auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	_ = user
	groups, err := db.ListMachineGroups(ctx)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar grupos"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, groups)
}

func monitoringGroupMachines(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers group machines auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	groupID := chi.URLParam(r, "id")
	machines, err := db.MachinesByGroupID(ctx, groupID)
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
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers machine detail auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	id := chi.URLParam(r, "id")
	machine, err := db.MachineByID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}
	hw, _ := db.MachineHardwareByMachineID(ctx, id)
	lib.WriteJSON(w, http.StatusOK, map[string]any{"machine": machine, "hardware": hw})
}

func monitoringMachineMetrics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers metrics auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	id := chi.URLParam(r, "id")
	limit := 100
	if ls := r.URL.Query().Get("limit"); ls != "" {
		if l, err := strconv.Atoi(ls); err == nil && l > 0 {
			limit = l
		}
	}
	metrics, err := db.MetricsByMachineID(ctx, id, limit)
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
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers alerts auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	id := chi.URLParam(r, "id")
	alerts, err := db.AlertsByMachineID(ctx, id)
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
	AgentKey     string            `json:"agent_key"`
	MachineToken string            `json:"machine_token"`
	MachineUUID  string            `json:"machine_uuid"`
	CurrentUser  string            `json:"current_user"`
	Hostname     string            `json:"hostname"`
	IP           string            `json:"ip"`
	OS           string            `json:"os"`
	OSVersion    string            `json:"os_version"`
	AgentVersion string            `json:"agent_version"`
	CPUUsage     float64           `json:"cpu_usage"`
	RAMTotal     int64             `json:"ram_total"`
	RAMUsed      int64             `json:"ram_used"`
	DiskTotal    int64             `json:"disk_total"`
	DiskUsed     int64             `json:"disk_used"`
	Uptime       int64             `json:"uptime"`
	CPUModel     string            `json:"cpu_model"`
	GPU          string            `json:"gpu"`
	Disks        json.RawMessage   `json:"disks"`
	Interfaces   json.RawMessage   `json:"interfaces"`
	Domain       string            `json:"domain"`
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
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Conexão com o banco de dados não inicializada (verifique DATABASE_URL)"})
		return
	}

	// Timeout de 5s para operações de banco
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	key := agentKeyHeader
	if key == "" {
		key = req.AgentKey
	}
	
	companyIDFromKey, err := lib.ValidateAgentKey(&http.Request{Header: http.Header{"X-Agent-Key": {key}}}, cfg.AgentKey, db)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	// targetCompanyID is already determined above
	
	// Utilizando o contexto com timeout criado acima

	// Final company assignment logic
	var targetCompanyID string
	if companyIDFromKey != "" && companyIDFromKey != "global" {
		targetCompanyID = companyIDFromKey
	} else if req.Domain != "" {
		// Try lookup by domain if global key is used
		cid, err := db.CompanyByDomain(ctx, req.Domain)
		if err == nil {
			targetCompanyID = cid
		}
	}

	// FALLBACK: Se ainda não tiver empresa (ex: instalação nova/geral), 
	// vamos vincular à primeira empresa do banco para que não fique órfã
	if targetCompanyID == "" {
		firstCID, _ := db.FirstCompanyID(ctx)
		if firstCID != "" {
			targetCompanyID = firstCID
			fmt.Printf("[DEBUG] Heartbeat fallback: vinculando %s à empresa %s\n", req.Hostname, targetCompanyID)
		}
	}

	if req.Hostname == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "hostname é obrigatório"})
		return
	}

	// Tratamento do Domínio via GetOrCreateMachineGroup
	domain := req.Domain
	if domain == "" {
		domain = "WORKGROUP"
	}
	
	groupID, err := db.GetOrCreateMachineGroup(ctx, domain, targetCompanyID)
	if err != nil {
		fmt.Println("Erro GetOrCreateMachineGroup:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar grupo de máquina: %v", err)})
		return
	}

	machineID, err := db.UpsertMachine(ctx, groupID, req.Hostname, req.IP, req.OS, req.OSVersion, req.AgentVersion, req.MachineToken, req.MachineUUID, req.CurrentUser, targetCompanyID)
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
	ifacesJSON := req.Interfaces
	if len(ifacesJSON) == 0 {
		ifacesJSON = json.RawMessage(`[]`)
	}
	_ = db.UpsertHardware(ctx, lib.UpsertHardwareInput{
		MachineID: machineID, CPUModel: req.CPUModel,
		RAMSlots: []byte(`null`), Disks: disksJSON, NetworkInterfaces: ifacesJSON, GPU: req.GPU,
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

// ─── Remote Commands ──────────────────────────────────────────────────────────

func monitoringCreateCommand(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers create cmd auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	machineID := chi.URLParam(r, "id")
	var req struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}

	id, err := db.CreateCommand(ctx, lib.InsertCommandInput{
		MachineID: machineID,
		Command:   req.Command,
	})
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao criar comando"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"id": id})
}

func monitoringGetMachineCommands(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers list cmds auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	_ = user
	machineID := chi.URLParam(r, "id")
	cmds, err := db.ListCommandsByMachineID(ctx, machineID, 50)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao buscar comandos"})
		return
	}
	if cmds == nil {
		cmds = []lib.CommandRow{}
	}
	lib.WriteJSON(w, http.StatusOK, cmds)
}

func monitoringPollCommands(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	// Require Agent Key
	_, err := lib.ValidateAgentKey(r.WithContext(ctx), cfg.AgentKey, db)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	machineID := r.URL.Query().Get("machine_id")
	if machineID == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "machine_id obrigatório"})
		return
	}

	cmds, err := db.GetPendingCommands(ctx, machineID)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	if len(cmds) == 0 {
		lib.WriteJSON(w, http.StatusOK, []any{})
		return
	}

	// For simplicity, once polled, we mark them as 'sent'
	for _, c := range cmds {
		_ = db.UpdateCommandStatus(ctx, c.ID, "sent", "")
	}

	lib.WriteJSON(w, http.StatusOK, cmds)
}

func monitoringCommandResponse(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	// Require Agent Key
	_, err := lib.ValidateAgentKey(r.WithContext(ctx), cfg.AgentKey, db)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	var req struct {
		ID     string `json:"id"`
		Status string `json:"status"` // completed, failed
		Output string `json:"output"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}

	err = db.UpdateCommandStatus(ctx, req.ID, req.Status, req.Output)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// ─── Management ─────────────────────────────────────────────────────────────

func monitoringUpdateMachine(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	// Check management roles
	role, _ := requireAdminOrDeveloper(r, user.ID)
	// If it's "gestor", it's also allowed (gestor is allowed for monitoring)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	id := chi.URLParam(r, "id")
	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "JSON inválido"})
		return
	}

	// Allowed fields to update
	allowed := map[string]bool{"group_id": true, "company_id": true, "hostname": true}
	refinedUpdates := make(map[string]any)
	for k, v := range updates {
		if allowed[k] {
			// Convert empty string to nil for UUID columns to avoid syntax error
			if s, ok := v.(string); ok && s == "" && (k == "group_id" || k == "company_id") {
				refinedUpdates[k] = nil
			} else {
				refinedUpdates[k] = v
			}
		}
	}

	if err := db.UpdateMachine(ctx, id, refinedUpdates); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

func monitoringCreateGroup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	var req struct {
		Name          string `json:"name"`
		Description   string `json:"description"`
		ClientContact string `json:"client_contact"`
		CompanyID     string `json:"company_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "JSON inválido"})
		return
	}

	id, err := db.CreateMachineGroup(ctx, req.Name, req.Description, req.ClientContact, req.CompanyID)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"id": id})
}

func monitoringUpdateGroup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	id := chi.URLParam(r, "id")
	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "JSON inválido"})
		return
	}

	allowed := map[string]bool{"name": true, "description": true, "client_contact": true, "company_id": true}
	refined := make(map[string]any)
	for k, v := range updates {
		if allowed[k] {
			// Convert empty string to nil for UUID columns to avoid syntax error
			if s, ok := v.(string); ok && s == "" && k == "company_id" {
				refined[k] = nil
			} else {
				refined[k] = v
			}
		}
	}

	if err := db.UpdateMachineGroup(ctx, id, refined); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

func monitoringDeleteGroup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	id := chi.URLParam(r, "id")
	if err := db.DeleteMachineGroup(ctx, id); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// ─── Critical Alerts (Red Zone Dashboard) ─────────────────────────────────────

func monitoringCriticalAlerts(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	_ = user
	alerts, err := db.CriticalAlerts(ctx)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar alertas críticos"})
		return
	}
	if alerts == nil {
		alerts = []lib.CriticalAlertItem{}
	}
	lib.WriteJSON(w, http.StatusOK, alerts)
}
