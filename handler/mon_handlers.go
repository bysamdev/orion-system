package handler

// mon_handlers.go — handlers for /api/monitoring/* endpoints.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// ─── Escopo por empresa nas leituras (pentest Strix vuln-0003) ───────────────
//
// O pool do backend conecta com papel privilegiado, então RLS não se aplica a
// estas queries: sem recorte explícito aqui, qualquer usuário autenticado lia o
// parque inteiro de todas as empresas. O critério de "vê tudo" espelha as
// policies de RLS já existentes — empresa master ou papel developer.
//
// monitoringCreateCommand já fazia essa checagem; estes helpers estendem o
// mesmo limite às leituras.

// escopoDoUsuario resolve empresa/papel do chamador.
//
// Nas rotas cobertas por RequireCompanyScope (todas as de usuário) o escopo já
// foi resolvido pelo middleware e vem do contexto, sem nova ida ao banco. O
// lookup direto permanece como fallback para qualquer chamador fora do grupo.
func escopoDoUsuario(ctx context.Context, userID string) (lib.UserScope, error) {
	if escopo, ok := lib.ScopeFromContext(ctx); ok {
		return escopo, nil
	}
	return db.UserScopeByID(ctx, userID)
}

// podeVerMaquina decide o acesso quando a máquina já foi carregada.
func podeVerMaquina(ctx context.Context, userID string, machineCompanyID *string) bool {
	escopo, err := escopoDoUsuario(ctx, userID)
	if err != nil {
		return false // sem conseguir provar o vínculo, nega
	}
	return escopo.PodeVerEmpresa(machineCompanyID)
}

// podeVerMaquinaPorID carrega a máquina só para checar a empresa dona. Usado
// nas rotas cujo recurso é derivado da máquina (métricas, alertas, comandos).
func podeVerMaquinaPorID(ctx context.Context, userID, machineID string) bool {
	m, err := db.MachineByID(ctx, machineID)
	if err != nil {
		return false
	}
	return podeVerMaquina(ctx, userID, m.CompanyID)
}

func monitoringDashboard(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers dashboard auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	s, err := db.DashboardSummaryData(ctx, escopo.FiltroEmpresa())
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

	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	groups, err := db.ListMachineGroups(ctx, escopo.FiltroEmpresa())
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

	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	groupID := chi.URLParam(r, "id")
	machines, err := db.MachinesByGroupID(ctx, groupID, escopo.FiltroEmpresa())
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

	id := chi.URLParam(r, "id")
	machine, err := db.MachineByID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}
	if !podeVerMaquina(ctx, user.ID, machine.CompanyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
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

	id := chi.URLParam(r, "id")
	if !podeVerMaquinaPorID(ctx, user.ID, id) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}
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

	id := chi.URLParam(r, "id")
	if !podeVerMaquinaPorID(ctx, user.ID, id) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}
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
	AgentKey       string          `json:"agent_key"`
	MachineToken   string          `json:"machine_token"`
	MachineUUID    string          `json:"machine_uuid"`
	CurrentUser    string          `json:"current_user"`
	CurrentUserSID string          `json:"current_user_sid"`
	Hostname       string          `json:"hostname"`
	IP             string          `json:"ip"`
	OS             string          `json:"os"`
	OSVersion      string          `json:"os_version"`
	AgentVersion   string          `json:"agent_version"`
	CPUUsage       float64         `json:"cpu_usage"`
	RAMTotal       int64           `json:"ram_total"`
	RAMUsed        int64           `json:"ram_used"`
	DiskTotal      int64           `json:"disk_total"`
	DiskUsed       int64           `json:"disk_used"`
	Uptime         int64           `json:"uptime"`
	CPUModel       string          `json:"cpu_model"`
	GPU            string          `json:"gpu"`
	Disks          json.RawMessage `json:"disks"`
	Interfaces     json.RawMessage `json:"interfaces"`
	Domain         string          `json:"domain"`
	MACAddress     string          `json:"mac_address"`
	DeviceType     string          `json:"device_type"`
	Security       json.RawMessage `json:"security"`
	RemoteSoftware json.RawMessage `json:"remote_software"`
	Battery        json.RawMessage `json:"battery"`
	UpdateStatus   json.RawMessage `json:"update_status"`
}

type securityData struct {
	Antivirus []struct {
		Name   string `json:"name"`
		Active bool   `json:"active"`
	} `json:"antivirus"`
	FirewallActive bool `json:"firewall_active"`
}

type updateStatusData struct {
	RebootRequired bool `json:"reboot_required"`
}

func monitoringHeartbeat(w http.ResponseWriter, r *http.Request) {
	// Correção A.3: limite generoso e por IP — múltiplas máquinas de um mesmo
	// escritório costumam sair pelo mesmo IP público (NAT), então um limite
	// apertado aqui derrubaria heartbeats legítimos. O objetivo é conter uma
	// chave vazada sendo usada para inundar o endpoint, não o uso normal.
	ip := lib.ClientIP(r)
	if !agentRateLimitAllow(r.Context(), "heartbeat", ip, 300, time.Minute, limiterHeartbeat) {
		log.Printf("[ALERTA] heartbeat: limite de taxa excedido para IP %s", ip)
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

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

	// Correção A.9: antes, se nenhuma empresa fosse resolvida (chave global
	// sem domínio reconhecido, por exemplo), o heartbeat era silenciosamente
	// vinculado à PRIMEIRA empresa do banco (db.FirstCompanyID) — quebra real
	// de isolamento multi-tenant, sem log de erro nem rejeição visível.
	// Agora a máquina fica sem check-in até a empresa poder ser determinada
	// de verdade (chave específica por empresa, ou domínio já cadastrado).
	if targetCompanyID == "" {
		msg := "não foi possível determinar a empresa desta máquina — configure uma chave de agente específica da empresa"
		if req.Domain != "" {
			msg += fmt.Sprintf(", ou cadastre o domínio %q para uma empresa", req.Domain)
		}
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": msg})
		return
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

	machineID, err := db.HeartbeatUpsert(ctx, lib.HeartbeatUpsertInput{
		GroupID: groupID, Hostname: req.Hostname, IP: req.IP, OS: req.OS, OSVersion: req.OSVersion,
		AgentVersion: req.AgentVersion, MachineToken: req.MachineToken, MachineUUID: req.MachineUUID,
		CurrentUser: req.CurrentUser, CurrentUserSID: req.CurrentUserSID, CompanyID: targetCompanyID,
		DeviceType: req.DeviceType, MACAddress: req.MACAddress, Domain: req.Domain,
		CPUUsage: req.CPUUsage, RAMTotal: req.RAMTotal, RAMUsed: req.RAMUsed,
		DiskTotal: req.DiskTotal, DiskUsed: req.DiskUsed, Uptime: req.Uptime,
	})
	if err != nil {
		fmt.Println("Erro HeartbeatUpsert:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar máquina: %v", err)})
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
	if err := db.UpsertHardware(ctx, lib.UpsertHardwareInput{
		MachineID:         machineID,
		CPUModel:          req.CPUModel,
		RAMSlots:          []byte(`null`),
		Disks:             disksJSON,
		NetworkInterfaces: ifacesJSON,
		GPU:               req.GPU,
		SecurityInfo:      req.Security,
		RemoteSoftware:    req.RemoteSoftware,
		BatteryInfo:       req.Battery,
		UpdateStatus:      req.UpdateStatus,
	}); err != nil {
		log.Printf("[ERRO] heartbeat: falha ao salvar hardware para %s (%s): %v", req.Hostname, machineID, err)
	}

	hasAlert := false

	if req.CPUUsage > 85 {
		_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
			MachineID: machineID, Type: "cpu", Severity: "warning",
			Message: fmt.Sprintf("Uso de CPU alto: %.1f%%", req.CPUUsage),
		})
		hasAlert = true
	} else {
		_ = db.ResolveAlertsByType(ctx, machineID, "cpu")
	}

	if req.RAMTotal > 0 {
		ramUsage := float64(req.RAMUsed) / float64(req.RAMTotal)
		if ramUsage > 0.90 {
			_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
				MachineID: machineID, Type: "ram", Severity: "warning",
				Message: fmt.Sprintf("Uso de RAM alto: %.1f%%", ramUsage*100),
			})
			hasAlert = true
		} else {
			_ = db.ResolveAlertsByType(ctx, machineID, "ram")
		}
	}

	if req.DiskTotal > 0 {
		diskUsage := float64(req.DiskUsed) / float64(req.DiskTotal)
		if diskUsage > 0.90 {
			_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
				MachineID: machineID, Type: "disk", Severity: "critical",
				Message: fmt.Sprintf("Uso de disco crítico: %.1f%% (%d/%d bytes)", diskUsage*100, req.DiskUsed, req.DiskTotal),
			})
			hasAlert = true
		} else {
			_ = db.ResolveAlertsByType(ctx, machineID, "disk")
		}
	}

	// Avaliação de conformidade para a Zona Vermelha (Segurança & Antivírus)
	if len(req.Security) > 0 && string(req.Security) != "null" {
		var sec securityData
		if err := json.Unmarshal(req.Security, &sec); err == nil {
			hasActiveAV := false
			for _, av := range sec.Antivirus {
				if av.Active {
					hasActiveAV = true
					break
				}
			}
			if !hasActiveAV {
				_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
					MachineID: machineID,
					Type:      "antivirus",
					Severity:  "critical",
					Message:   "Antivírus desativado ou ausente",
				})
				hasAlert = true
			} else {
				_ = db.ResolveAlertsByType(ctx, machineID, "antivirus")
			}

			if !sec.FirewallActive {
				_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
					MachineID: machineID,
					Type:      "firewall",
					Severity:  "warning",
					Message:   "Firewall do Windows desativado",
				})
				hasAlert = true
			} else {
				_ = db.ResolveAlertsByType(ctx, machineID, "firewall")
			}
		}
	}

	// Atualizações de sistema (sem geração de alerta de reinicialização conforme preferência)
	_ = db.ResolveAlertsByType(ctx, machineID, "updates")

	// Verifica se ainda existem alertas não resolvidos para esta máquina
	if hasActive, err := db.HasUnresolvedAlerts(ctx, machineID); err == nil {
		hasAlert = hasAlert || hasActive
	}

	if hasAlert {
		_ = db.UpdateMachineStatus(ctx, machineID, "alerta")
	} else {
		_ = db.UpdateMachineStatus(ctx, machineID, "online")
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

	// RequireUserRole: apenas admin, developer e technician podem enviar comandos remotos.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível verificar permissões do usuário"})
		return
	}
	if escopo.Role != "admin" && escopo.Role != "technician" && escopo.Role != "developer" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem enviar comandos remotos"})
		return
	}

	machineID := chi.URLParam(r, "id")
	machine, err := db.MachineByID(ctx, machineID)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}

	// ValidateMachineTenancy: escopo de empresa/global — nunca role isolado, para
	// não permitir que um admin de uma empresa comande máquinas de outra (SEC-01).
	if !escopo.PodeVerEmpresa(machine.CompanyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}

	var req struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}

	// Validação mínima: command não pode ser vazio
	if req.Command == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "campo 'command' é obrigatório"})
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

	machineID := chi.URLParam(r, "id")
	if !podeVerMaquinaPorID(ctx, user.ID, machineID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}
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

	// Sem limitador antes desta correção — poll roda a cada 30s por máquina,
	// mesma ordem de grandeza do heartbeat.
	ip := lib.ClientIP(r)
	if !agentRateLimitAllow(ctx, "commands-poll", ip, 300, time.Minute, limiterCommandsPoll) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

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

	// Marca todos como 'sent' numa única query (antes: um UPDATE por comando)
	ids := make([]string, len(cmds))
	for i, c := range cmds {
		ids[i] = c.ID
	}
	if err := db.MarkCommandsSent(ctx, ids); err != nil {
		log.Printf("[ERRO] commands/poll: falha ao marcar comandos como enviados: %v", err)
	}

	lib.WriteJSON(w, http.StatusOK, cmds)
}

func monitoringCommandResponse(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	// Sem limitador antes desta correção.
	ip := lib.ClientIP(r)
	if !agentRateLimitAllow(ctx, "commands-respond", ip, 300, time.Minute, limiterCommandsResp) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

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

	// requireAdminOrDeveloper só valida o papel do chamador, nunca a empresa —
	// sem isto, um admin/gestor de QUALQUER empresa atualizava (e reatribuía)
	// a máquina de qualquer outra empresa só sabendo o id.
	machine, err := db.MachineByID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.PodeVerEmpresa(machine.CompanyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}

	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "JSON inválido"})
		return
	}

	// Allowed fields to update
	allowed := map[string]bool{"group_id": true, "company_id": true, "hostname": true}
	refinedUpdates := make(map[string]any)
	for k, v := range updates {
		if !allowed[k] {
			continue
		}
		// Só quem enxerga tudo (master/developer) pode reatribuir a empresa
		// dona da máquina — senão um usuário escopado "moveria" a máquina
		// para fora do alcance de PodeVerEmpresa e escaparia do isolamento.
		if k == "company_id" && !escopo.Global() {
			continue
		}
		// Convert empty string to nil for UUID columns to avoid syntax error
		if s, ok := v.(string); ok && s == "" && (k == "group_id" || k == "company_id") {
			refinedUpdates[k] = nil
		} else {
			refinedUpdates[k] = v
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

	// requireAdminOrDeveloper só valida o papel — sem isto, um admin/gestor de
	// qualquer empresa criava grupo em QUALQUER company_id informado no corpo.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.Global() {
		if escopo.CompanyID == nil {
			lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
			return
		}
		req.CompanyID = *escopo.CompanyID
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

	// requireAdminOrDeveloper só valida o papel, nunca se o grupo pertence à
	// empresa do chamador — sem isto, um admin/gestor de qualquer empresa
	// editava (e reatribuía) o grupo de qualquer outra empresa por id.
	groupCompanyID, err := db.MachineGroupCompanyID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Grupo não encontrado"})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.PodeVerEmpresa(groupCompanyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: grupo não pertence à sua empresa"})
		return
	}

	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "JSON inválido"})
		return
	}

	allowed := map[string]bool{"name": true, "description": true, "client_contact": true, "company_id": true}
	refined := make(map[string]any)
	for k, v := range updates {
		if !allowed[k] {
			continue
		}
		// Só quem enxerga tudo pode reatribuir a empresa dona do grupo — mesmo
		// raciocínio de monitoringUpdateMachine.
		if k == "company_id" && !escopo.Global() {
			continue
		}
		// Convert empty string to nil for UUID columns to avoid syntax error
		if s, ok := v.(string); ok && s == "" && k == "company_id" {
			refined[k] = nil
		} else {
			refined[k] = v
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

	// requireAdminOrDeveloper só valida o papel — sem isto, um admin/gestor de
	// qualquer empresa apagava o grupo de qualquer outra empresa por id.
	groupCompanyID, err := db.MachineGroupCompanyID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Grupo não encontrado"})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.PodeVerEmpresa(groupCompanyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: grupo não pertence à sua empresa"})
		return
	}

	if err := db.DeleteMachineGroup(ctx, id); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// ─── Self-Healing ───────────────────────────────────────────────────────────

func monitoringSelfHealEvent(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	// Sem limitador antes desta correção.
	ip := lib.ClientIP(r)
	if !agentRateLimitAllow(ctx, "self-heal-event", ip, 300, time.Minute, limiterSelfHealEvent) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

	// Require Agent Key
	chaveEmpresaID, err := lib.ValidateAgentKey(r.WithContext(ctx), cfg.AgentKey, db)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	var req struct {
		MachineID string `json:"machine_id"`
		AlertType string `json:"alert_type"`
		Status    string `json:"status"` // "success" ou "failed"
		Output    string `json:"output"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}
	if req.MachineID == "" || req.AlertType == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "machine_id e alert_type são obrigatórios"})
		return
	}
	if req.Status != "success" && req.Status != "failed" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "status deve ser 'success' ou 'failed'"})
		return
	}

	machine, err := db.MachineByID(ctx, req.MachineID)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}

	// A chave de agente prova a identidade de UMA empresa, mas machine_id vem do
	// corpo da requisição: sem esta checagem, um agente legítimo da empresa A
	// grava eventos de autocura em máquinas da empresa B. A chave global
	// ("global") é a de administração e segue podendo reportar qualquer máquina.
	if chaveEmpresaID != "" && chaveEmpresaID != "global" {
		if machine.CompanyID == nil || *machine.CompanyID != chaveEmpresaID {
			lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "máquina não pertence à empresa desta chave de agente"})
			return
		}
	}

	// Registrado em rmm_remediation_logs — não em tickets. public.tickets exige
	// user_id/requester_name/category NOT NULL e este endpoint é autenticado por
	// chave de agente, sem usuário por trás para satisfazer o FK de user_id.
	//
	// machine.CompanyID é *string de propósito: máquina órfã (company_id nulo)
	// grava log sem empresa em vez de derrubar o handler com nil dereference.
	if err := db.InsertRemediationLog(ctx, lib.InsertRemediationLogInput{
		MachineID: req.MachineID,
		CompanyID: machine.CompanyID,
		AlertType: req.AlertType,
		Status:    req.Status,
		Output:    req.Output,
	}); err != nil {
		log.Printf("[ERRO] falha ao registrar evento de autocura (machine=%s): %v", req.MachineID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao registrar evento de autocura"})
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

	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	alerts, err := db.CriticalAlerts(ctx, escopo.FiltroEmpresa())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar alertas críticos"})
		return
	}
	if alerts == nil {
		alerts = []lib.CriticalAlertItem{}
	}
	lib.WriteJSON(w, http.StatusOK, alerts)
}
