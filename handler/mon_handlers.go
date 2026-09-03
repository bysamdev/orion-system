package handler

// mon_handlers.go — handlers for /api/monitoring/* endpoints.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
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

// monitoringPlatformHealth expõe a saúde agregada da frota inteira,
// cross-tenant — "monitorar o monitor" (Fase 10 do plano de
// escalabilidade). Restrito a quem enxerga tudo (master/developer): não é
// uma visão de nenhum cliente específico, é operação da própria plataforma.
func monitoringPlatformHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
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
	if !escopo.Global() {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	health, err := db.PlatformHealth(ctx)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao calcular saúde da plataforma"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, health)
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
		// Exposto pro front-end decidir quais máquinas estão desatualizadas
		// (botão "Atualizar todas", ver ForceUpdateButton.tsx) sem
		// hardcodear a versão mais recente em dois lugares — já bump
		// bastante ao longo do desenvolvimento do agente pra arriscar ficar
		// dessincronizado.
		"latest_agent_version": lib.LatestAgentVersion,
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

// monitoringPendingMachines lista máquinas que já mandaram heartbeat mas
// ainda não foram aprovadas por um admin/técnico — a fila que existe pra
// nunca mais uma VM de sandbox (VirusTotal e afins) aparecer direto como
// máquina online no painel (ver migration add_machine_approval_gate).
func monitoringPendingMachines(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem revisar máquinas pendentes"})
		return
	}

	pending, err := db.PendingMachines(ctx, escopo.FiltroEmpresa())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar máquinas pendentes"})
		return
	}
	if pending == nil {
		pending = []lib.PendingMachineRow{}
	}
	lib.WriteJSON(w, http.StatusOK, pending)
}

// monitoringApproveMachine libera uma máquina pendente pra entrar no painel.
func monitoringApproveMachine(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem aprovar máquinas"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}
	if err := db.ApproveMachine(ctx, id, escopo.FiltroEmpresa()); err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// monitoringRejectMachine nega e apaga uma máquina pendente — mesmo destino
// de uma máquina fantasma de sandbox: some do banco, nunca mais aparece na
// fila (CASCADE cuida de hardware/alertas/comandos associados).
func monitoringRejectMachine(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem rejeitar máquinas"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}
	if err := db.RejectMachine(ctx, id, escopo.FiltroEmpresa()); err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// monitoringDeleteMachine exclui definitivamente uma máquina do parque (CASCADE cuida de
// hardware, alertas, comandos etc.). Restrito a administradores, técnicos e desenvolvedores.
func monitoringDeleteMachine(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem excluir máquinas"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}
	if err := db.DeleteMachine(ctx, id, escopo.FiltroEmpresa()); err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// monitoringAllMachines lista todas as máquinas aprovadas do escopo do
// chamador num único round-trip — usado pela visão "Todos" do
// Monitoramento, que antes fazia 1 request por grupo no front-end
// (useAllMachines, ver useMonitoring.ts).
func monitoringAllMachines(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
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
	machines, err := db.AllMachines(ctx, escopo.FiltroEmpresa())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar máquinas"})
		return
	}
	if machines == nil {
		machines = []lib.MachineWithMetric{}
	}
	lib.WriteJSON(w, http.StatusOK, machines)
}

// monitoringMachineTickets lista o histórico de chamados abertos por uma
// máquina — na prática, todo chamado aberto por qualquer pessoa que usou
// essa máquina, já que a sessão do "Abrir Chamado" sempre autentica pelo
// mesmo usuário-fantasma da máquina (ver lib.MachineGhostEmail). Sem
// coluna nova nem migration: resolve o e-mail-fantasma a partir do
// machine_token (nunca devolvido ao chamador) e busca o user_id
// correspondente.
func monitoringMachineTickets(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}

	token, companyID, err := db.MachineTokenAndCompanyByID(ctx, id)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}
	if !podeVerMaquina(ctx, user.ID, companyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: máquina não pertence à sua empresa"})
		return
	}

	// Máquina existe mas nunca completou um "Abrir Chamado" (nenhum
	// usuário-fantasma chegou a ser criado) — histórico vazio, não erro.
	ghostUserID, err := db.AuthUserIDByEmail(ctx, lib.MachineGhostEmail(token))
	if err != nil {
		lib.WriteJSON(w, http.StatusOK, []lib.MachineTicketRow{})
		return
	}

	tickets, err := db.TicketsByUserID(ctx, ghostUserID, 100)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar histórico de chamados"})
		return
	}
	if tickets == nil {
		tickets = []lib.MachineTicketRow{}
	}
	lib.WriteJSON(w, http.StatusOK, tickets)
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
	if !limiterMetricsHistory.Permitir(lib.ClientIP(r)) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

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

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "1h"
	}

	// Vem do Postgres, não mais do Prometheus: o scrape só alcança máquina na
	// mesma rede do servidor de monitoramento, então todo equipamento atrás de
	// NAT ou em outro site ficava sem gráfico. O heartbeat chega de qualquer
	// rede e agora alimenta machine_metrics_history (ver AppendMetricPoint).
	// O Prometheus segue valendo pros alertas do que ele consegue scrapear.
	janela, passo := lib.JanelaHistorico(period)
	metrics, err := db.MetricsHistory(ctx, id, janela, passo)
	if err != nil {
		log.Printf("[ERRO] histórico de métricas para %s: %v", id, err)
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
	AgentKey         string          `json:"agent_key"`
	MachineToken     string          `json:"machine_token"`
	MachineUUID      string          `json:"machine_uuid"`
	CurrentUser      string          `json:"current_user"`
	CurrentUserSID   string          `json:"current_user_sid"`
	Hostname         string          `json:"hostname"`
	IP               string          `json:"ip"`
	OS               string          `json:"os"`
	OSVersion        string          `json:"os_version"`
	AgentVersion     string          `json:"agent_version"`
	CPUUsage         float64         `json:"cpu_usage"`
	RAMTotal         int64           `json:"ram_total"`
	RAMUsed          int64           `json:"ram_used"`
	DiskTotal        int64           `json:"disk_total"`
	DiskUsed         int64           `json:"disk_used"`
	Uptime           int64           `json:"uptime"`
	CPUModel         string          `json:"cpu_model"`
	GPU              string          `json:"gpu"`
	Disks            json.RawMessage `json:"disks"`
	Interfaces       json.RawMessage `json:"interfaces"`
	Domain           string          `json:"domain"`
	MACAddress       string          `json:"mac_address"`
	DeviceType       string          `json:"device_type"`
	DeviceTypeReason string          `json:"device_type_reason"`
	Security         json.RawMessage `json:"security"`
	RemoteSoftware   json.RawMessage `json:"remote_software"`
	Battery          json.RawMessage `json:"battery"`
	UpdateStatus     json.RawMessage `json:"update_status"`
}

// deviceTypesValidos são os únicos valores aceitos para device_type num
// override manual (monitoringUpdateMachine) — os mesmos que o agente pode
// reportar, ver orion-agent/collector/device_type_windows.go /
// device_type_other.go.
var deviceTypesValidos = map[string]bool{
	"desktop": true, "notebook": true, "server": true, "unknown": true,
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

	machineID, deviceTypeGravado, approvalStatus, err := db.UpsertMachine(ctx, groupID, req.Hostname, req.IP, req.OS, req.OSVersion, req.AgentVersion, req.MachineToken, req.MachineUUID, req.CurrentUser, req.CurrentUserSID, targetCompanyID, req.DeviceType, req.MACAddress, req.Domain, req.DeviceTypeReason)
	if err != nil {
		fmt.Println("Erro UpsertMachine:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar máquina: %v", err)})
		return
	}

	if approvalStatus == "rejected" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "máquina rejeitada pela administração"})
		return
	}

	// Sincroniza automaticamente o domínio da empresa se estiver vazio
	if domain != "" && domain != "." && targetCompanyID != "" {
		_ = db.SyncCompanyDomainIfEmpty(ctx, targetCompanyID, domain)
	}

	amostra := lib.InsertMetricInput{
		MachineID: machineID, CPUUsage: req.CPUUsage,
		RAMTotal: req.RAMTotal, RAMUsed: req.RAMUsed,
		DiskTotal: req.DiskTotal, DiskUsed: req.DiskUsed, Uptime: req.Uptime,
	}
	if err := db.UpdateMachineSnapshot(ctx, amostra); err != nil {
		fmt.Println("Erro UpdateMachineSnapshot:", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao registrar métricas: %v", err)})
		return
	}

	// Série histórica do gráfico de performance. Best-effort de propósito: o
	// ponto de um heartbeat perdido não vale derrubar o heartbeat inteiro,
	// que é também o que mantém a máquina online e carrega o inventário.
	if err := db.AppendMetricPoint(ctx, amostra); err != nil {
		log.Printf("[AVISO] gravar ponto histórico da máquina %s: %v", machineID, err)
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

	// Tipos de alerta que este heartbeat prova estarem normalizados.
	// Acumulados aqui e resolvidos num UPDATE so no fim, em vez de um
	// round-trip por tipo — ver lib.ResolveAlertTypes.
	resolver := make([]string, 0, 7)

	if req.CPUUsage > 85 {
		_ = db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
			MachineID: machineID, Type: "cpu", Severity: "warning",
			Message: fmt.Sprintf("Uso de CPU alto: %.1f%%", req.CPUUsage),
		})
		hasAlert = true
	} else {
		resolver = append(resolver, "cpu")
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
			resolver = append(resolver, "ram")
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
			// Apenas servidores abrem chamados automaticamente por alerta de disco crítico
			if deviceTypeGravado == "server" {
				_ = db.AbrirChamadoAlertaServidor(ctx, machineID, targetCompanyID, req.MachineToken, req.Hostname, "disk", "critical", fmt.Sprintf("Uso de disco crítico no servidor: %.1f%%", diskUsage*100))
			}
		} else {
			resolver = append(resolver, "disk")
			if deviceTypeGravado == "server" {
				_ = db.ResolverChamadoAlertaServidor(ctx, machineID, "disk")
			}
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
				// Apenas servidores abrem chamados automaticamente por antivírus inativo
				if deviceTypeGravado == "server" {
					_ = db.AbrirChamadoAlertaServidor(ctx, machineID, targetCompanyID, req.MachineToken, req.Hostname, "antivirus", "critical", "Antivírus desativado ou ausente no servidor")
				}
			} else {
				resolver = append(resolver, "antivirus")
				if deviceTypeGravado == "server" {
					_ = db.ResolverChamadoAlertaServidor(ctx, machineID, "antivirus")
				}
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
				resolver = append(resolver, "firewall")
			}
		}
	}

	// Atualizações de sistema (sem geração de alerta de reinicialização conforme preferência)
	resolver = append(resolver, "updates")

	// Este heartbeat É a prova de que a máquina está online agora — resolve
	// qualquer "Agente Offline" pendente aqui mesmo, sem esperar o Grafana
	// mandar o evento "resolved" (que só chega depois de alguns ciclos de
	// avaliação). Sem isso, HasUnresolvedAlerts logo abaixo via esse alerta
	// como ainda aberto e marcava a máquina como "alerta" em vez de
	// "online" nos primeiros minutos após ela voltar — ficar offline nunca
	// deveria contar como um motivo de alerta por si só (CPU/disco/
	// antivírus/firewall continuam contando normalmente).
	resolver = append(resolver, alertaAgenteOffline)
	_ = db.ResolveAlertTypes(ctx, machineID, resolver)
	if deviceTypeGravado == "server" {
		_ = db.ResolverChamadoAlertaServidor(ctx, machineID, alertaServidorOffline)
	}

	// Verifica se ainda existem alertas não resolvidos para esta máquina
	if hasActive, err := db.HasUnresolvedAlerts(ctx, machineID); err == nil {
		hasAlert = hasAlert || hasActive
	}

	if hasAlert {
		_ = db.UpdateMachineStatus(ctx, machineID, "alerta")
	} else {
		_ = db.UpdateMachineStatus(ctx, machineID, "online")
	}

	// Auto-atualização: a máquina reportou uma versão de agente diferente
	// da mais recente conhecida (lib.LatestAgentVersion) — enfileira um
	// comando "orion-install" pra ela buscar e instalar sozinha no próximo
	// poll (a cada 30s), sem nenhuma ação manual no painel. Best-effort de
	// propósito: nada aqui pode fazer o heartbeat falhar.
	if req.AgentVersion != "" && req.AgentVersion != lib.LatestAgentVersion {
		if _, err := enfileirarAutoUpdateSeNecessario(ctx, machineID, targetCompanyID, req.AgentVersion, key); err != nil {
			log.Printf("[AVISO] auto-atualização best-effort falhou (máquina %s): %v", machineID, err)
		}
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true, "machine_id": machineID,
		"next_interval_seconds": collectionIntervalSeconds(deviceTypeGravado),
	})
}

// collectionIntervalSeconds implementa a política de coleta por tipo de
// ativo (Fase 4 do plano de escalabilidade): o agente ajusta seu próprio
// ticker de heartbeat/métricas para o valor devolvido aqui em
// next_interval_seconds, a cada heartbeat bem-sucedido — sem precisar de
// reconfiguração manual do agent.yaml por máquina. "unknown" recebe a
// mesma cadência conservadora de estação/notebook, nunca a de servidor
// ("não assumir comportamento de servidor" — item explícito da
// especificação).
//
// Estação/notebook subiu de 180s pra 300s depois da medição de egress: com
// as 500 máquinas previstas, cada heartbeat custa ~500 bytes de resposta do
// Postgres, e a 180s isso dava ~3,6 GB/mês contra um teto de 5 GB no plano
// atual — sem contar o painel. A 300s cai pra ~2,2 GB.
//
// Servidor fica em 60s de propósito: é onde a detecção rápida de queda
// realmente vale, e servidores são a minoria do parque, então o custo de
// egress deles é pequeno. Notebook que dorme ou troca de rede não se
// beneficia de heartbeat de minuto em minuto — o que muda é só a latência
// pra aparecer offline, e cinco minutos é aceitável pra estação.
func collectionIntervalSeconds(deviceType string) int {
	if deviceType == "server" {
		return 60
	}
	return 300
}

// enfileirarAutoUpdateSeNecessario prepara o instalador mais recente da
// empresa e enfileira um comando de auto-atualização pra esta máquina,
// mas só se não já tiver um em trânsito (ver db.HasPendingUpdateCommand) —
// sem essa checagem, cada heartbeat (a cada ~60s) empilharia mais um
// comando idêntico enquanto o anterior ainda não terminou de ser
// executado/respondido pelo agente.
//
// enfileirado=false sem erro significa "pulado por já ter um comando
// pendente" — não é falha, só não havia nada novo a fazer. Devolve
// (bool, error) desde a correção que expôs isso no painel
// (monitoringForceUpdateMachine/monitoringForceUpdateOutdated, ver
// abaixo): antes só logava e retornava void, o que bastava pro caminho
// best-effort do heartbeat mas não dava pro admin saber se o clique em
// "Forçar atualização" realmente enfileirou algo.
func enfileirarAutoUpdateSeNecessario(ctx context.Context, machineID, companyID, versaoAtual, agentKey string) (bool, error) {
	jaTemAtualizacaoPendente, err := db.HasPendingUpdateCommand(ctx, machineID)
	if err != nil {
		log.Printf("[AVISO] verificar auto-atualização pendente (máquina %s): %v", machineID, err)
		return false, fmt.Errorf("verificar atualização pendente: %w", err)
	}
	if jaTemAtualizacaoPendente {
		return false, nil
	}

	companyName, err := db.CompanyName(ctx, companyID)
	if err != nil {
		log.Printf("[AVISO] nome da empresa pra auto-atualização (máquina %s): %v", machineID, err)
		return false, fmt.Errorf("resolver empresa: %w", err)
	}

	downloadURL, _, sha256Hex, err := prepararInstaladorDaEmpresa(ctx, companyID, agentKey, apiURLPublica(), companyName)
	if err != nil {
		log.Printf("[AVISO] preparar instalador pra auto-atualização (máquina %s): %v", machineID, err)
		return false, fmt.Errorf("preparar instalador: %w", err)
	}

	if _, err := db.CreateCommand(ctx, lib.InsertCommandInput{
		MachineID: machineID,
		Command:   lib.ComandoAutoUpdate(downloadURL, sha256Hex),
	}); err != nil {
		log.Printf("[AVISO] enfileirar auto-atualização (máquina %s): %v", machineID, err)
		return false, fmt.Errorf("enfileirar comando: %w", err)
	}
	log.Printf("[AUTO-UPDATE] comando enfileirado pra máquina %s (agente em %s, mais recente é %s)", machineID, versaoAtual, lib.LatestAgentVersion)
	return true, nil
}

// monitoringForceUpdateMachine enfileira uma atualização pra UMA máquina
// específica, a pedido explícito do admin — ao contrário do gatilho
// automático em monitoringHeartbeat, ignora se agent_version já bate com
// lib.LatestAgentVersion (o admin pode saber que o binário em disco está
// desatualizado mesmo que o último heartbeat reportado não reflita isso —
// ver a bandeja que fica presa numa versão antiga pra sempre até um
// restart manual, já documentado nesta sessão).
func monitoringForceUpdateMachine(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem forçar atualização"})
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
	if machine.CompanyID == nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Máquina sem empresa associada"})
		return
	}

	agentKey, err := db.ActiveOrNewAPIKey(ctx, *machine.CompanyID, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar a chave de autenticação"})
		return
	}

	versaoAtual := ""
	if machine.AgentVersion != nil {
		versaoAtual = *machine.AgentVersion
	}
	enfileirado, err := enfileirarAutoUpdateSeNecessario(ctx, machine.ID, *machine.CompanyID, versaoAtual, agentKey)
	if err != nil {
		log.Printf("[erro] enfileirarAutoUpdateSeNecessario machine=%s: %v", machine.ID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
		return
	}
	if !enfileirado {
		lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "enqueued": false, "message": "Já existe uma atualização pendente pra esta máquina"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "enqueued": true})
}

// monitoringForceUpdateOutdated enfileira atualização pra TODAS as máquinas
// aprovadas do escopo do chamador cuja agent_version reportada não bate
// com lib.LatestAgentVersion — o botão "Atualizar todas" do painel, pro
// caso comum de várias máquinas terem ficado pra trás.
func monitoringForceUpdateOutdated(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem forçar atualização"})
		return
	}

	machines, err := db.AllMachines(ctx, escopo.FiltroEmpresa())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao listar máquinas"})
		return
	}

	// Uma chave de API por empresa, resolvida uma vez e reaproveitada —
	// evita N chamadas a db.ActiveOrNewAPIKey quando várias máquinas
	// desatualizadas são da mesma empresa (o caso comum).
	chavesPorEmpresa := map[string]string{}
	var enfileiradas, jaAtualizadas, puladas int
	var erros []string

	for _, m := range machines {
		if m.AgentVersion == nil || *m.AgentVersion == lib.LatestAgentVersion {
			jaAtualizadas++
			continue
		}
		if m.CompanyID == nil {
			continue
		}

		agentKey, ok := chavesPorEmpresa[*m.CompanyID]
		if !ok {
			agentKey, err = db.ActiveOrNewAPIKey(ctx, *m.CompanyID, user.ID)
			if err != nil {
				erros = append(erros, fmt.Sprintf("%s: erro ao preparar chave da empresa", m.Hostname))
				continue
			}
			chavesPorEmpresa[*m.CompanyID] = agentKey
		}

		enfileirado, err := enfileirarAutoUpdateSeNecessario(ctx, m.ID, *m.CompanyID, *m.AgentVersion, agentKey)
		if err != nil {
			erros = append(erros, fmt.Sprintf("%s: %s", m.Hostname, err.Error()))
			continue
		}
		if enfileirado {
			enfileiradas++
		} else {
			puladas++
		}
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"enqueued":        enfileiradas,
		"already_pending": puladas,
		"already_updated": jaAtualizadas,
		"errors":          erros,
	})
}

// ─── Remote Commands ──────────────────────────────────────────────────────────

// papeisComandoRemoto são os únicos papéis autorizados a enviar comandos
// remotos (orion-install, terminal, etc.) — nunca customer.
var papeisComandoRemoto = map[string]bool{"admin": true, "technician": true, "developer": true}

// autorizarComandoRemoto decide se o escopo do chamador pode enviar um
// comando remoto pra uma máquina de uma dada empresa. Extraída de
// monitoringCreateCommand pra poder ser testada sem precisar de banco nem
// Supabase (ambos os checks já existiam — role e tenancy — só não tinham
// teste de integração cobrindo os três cenários: customer, técnico de outra
// empresa, e técnico/admin da empresa correta).
//
// Não confia em RLS pra isso: o pool do backend conecta com papel
// privilegiado (ver comentário SEC-01/Strix vuln-0003 no topo do arquivo),
// então estas DUAS checagens no handler são a única barreira real.
func autorizarComandoRemoto(escopo lib.UserScope, machineCompanyID *string) (permitido bool, mensagemErro string) {
	if !papeisComandoRemoto[escopo.Role] {
		return false, "Acesso restrito: apenas administradores e técnicos podem enviar comandos remotos"
	}
	if !escopo.PodeVerEmpresa(machineCompanyID) {
		return false, "Acesso restrito: máquina não pertence à sua empresa"
	}
	return true, ""
}

func monitoringCreateCommand(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		fmt.Printf("[DEBUG] mon_handlers create cmd auth error: %v\n", err)
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível verificar permissões do usuário"})
		return
	}

	machineID := chi.URLParam(r, "id")
	machine, err := db.MachineByID(ctx, machineID)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Máquina não encontrada"})
		return
	}

	if machine.ApprovalStatus != nil && *machine.ApprovalStatus != "approved" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: comandos só podem ser enviados para máquinas aprovadas"})
		return
	}

	if permitido, msg := autorizarComandoRemoto(escopo, machine.CompanyID); !permitido {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": msg})
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

	userName := user.Email
	if _, fullName, err := db.ProfileByID(ctx, user.ID); err == nil && fullName != nil && *fullName != "" {
		userName = *fullName
	}

	id, err := db.CreateCommand(ctx, lib.InsertCommandInput{
		MachineID:        machineID,
		Command:          req.Command,
		ExecutedByUserID: &user.ID,
		ExecutedByName:   &userName,
	})
	if err != nil {
		log.Printf("[ERRO] falha ao criar comando remoto: %v", err)
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
		log.Printf("[ERRO] falha ao listar comandos da máquina %s: %v", machineID, err)
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
	chaveEmpresaID, err := lib.ValidateAgentKey(r.WithContext(ctx), cfg.AgentKey, db)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	machineID := r.URL.Query().Get("machine_id")
	if machineID == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "machine_id obrigatório"})
		return
	}

	if chaveEmpresaID != "" && chaveEmpresaID != "global" {
		machine, err := db.MachineByID(ctx, machineID)
		if err != nil {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "máquina não encontrada"})
			return
		}
		if machine.CompanyID == nil || *machine.CompanyID != chaveEmpresaID {
			lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "máquina não pertence à empresa desta chave"})
			return
		}
	}

	cmds, err := db.GetPendingCommands(ctx, machineID)
	if err != nil {
		log.Printf("[ERRO] falha ao buscar comandos pendentes (machine=%s): %v", machineID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro interno ao processar comandos"})
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
	if err := db.UpdateCommandsStatusBatch(ctx, ids, "sent"); err != nil {
		log.Printf("[AVISO] falha ao marcar comandos como enviados (machine=%s): %v", machineID, err)
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
	chaveEmpresaID, err := lib.ValidateAgentKey(r.WithContext(ctx), cfg.AgentKey, db)
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

	if chaveEmpresaID != "" && chaveEmpresaID != "global" {
		companyID, err := db.CommandCompanyID(ctx, req.ID)
		if err != nil {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "comando não encontrado"})
			return
		}
		if companyID == nil || *companyID != chaveEmpresaID {
			lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "comando não pertence à empresa desta chave"})
			return
		}
	}

	err = db.UpdateCommandStatus(ctx, req.ID, req.Status, req.Output)
	if err != nil {
		log.Printf("[ERRO] falha ao atualizar status do comando %s: %v", req.ID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao atualizar status do comando"})
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

	// Fase 3 (override manual de classificação): tratado à parte do resto
	// dos campos genéricos abaixo porque precisa travar device_type_locked
	// e registrar a mudança em machine_device_type_history — não é um
	// simples UPDATE de coluna, ver lib.DB.SetDeviceTypeOverride.
	if raw, ok := updates["device_type"]; ok {
		newType, ok := raw.(string)
		if !ok || !deviceTypesValidos[newType] {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "device_type inválido — use desktop, notebook, server ou unknown"})
			return
		}
		if err := db.SetDeviceTypeOverride(ctx, id, newType); err != nil {
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		delete(updates, "device_type")
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
		log.Printf("[erro] UpdateMachine id=%s: %v", id, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
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
		log.Printf("[erro] CreateMachineGroup: %v", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
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
		log.Printf("[erro] UpdateMachineGroup id=%s: %v", id, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
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
		log.Printf("[erro] DeleteMachineGroup id=%s: %v", id, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
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

	// Se a autocura falhou em um SERVIDOR, abre chamado automático
	if req.Status == "failed" && machine.DeviceType != nil && *machine.DeviceType == "server" && machine.CompanyID != nil {
		tok := ""
		if machine.MachineToken != nil {
			tok = *machine.MachineToken
		}
		_ = db.AbrirChamadoAlertaServidor(ctx, req.MachineID, *machine.CompanyID, tok, machine.Hostname, "autocura_falha", "high", fmt.Sprintf("Falha na autocura para alerta '%s': %s", req.AlertType, req.Output))
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// ─── Grafana Alerting → Orion (webhook) ────────────────────────────────────────
//
// Fecha o lado "Prometheus/Grafana ➔ Orion" da integração de alertas: uma
// regra de Grafana Alerting (ver provisioning/alerting no servidor Debian)
// dispara, o contact point do tipo "webhook" chama este endpoint, e cada
// alerta vira uma linha em machine_alerts — a mesma tabela que já alimenta a
// Central de Alertas / zona vermelha do Orion. Nenhuma tabela nova, nenhuma
// tela nova: os alertas do Grafana só passam a aparecer onde os alertas do
// Orion já aparecem.
//
// machine_id chega como label da métrica que disparou o alerta — Prometheus
// herda esse label de agents.json (gerado pelo orion-bridge a partir de
// get_all_monitoring_targets()), então toda métrica do job "orion_agents" já
// carrega machine_id/company_id sem o agente precisar expor isso ele mesmo.
// Alertas de endpoints web/links de rede (que usam endpoint_id/link_id, não
// machine_id) ficam fora de escopo deste handler por ora.

type grafanaWebhookAlert struct {
	Status      string            `json:"status"` // "firing" ou "resolved"
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type grafanaWebhookPayload struct {
	Alerts []grafanaWebhookAlert `json:"alerts"`
}

// alertaAgenteOffline/alertaServidorOffline precisam bater exatamente com o
// `title` das regras "Agente Offline" e "Servidor Debian Offline" em
// rules.yaml (Grafana usa o title da regra como valor do label reservado
// `alertname`, sem sufixo/normalização). São os únicos tipos de alerta que
// também espelham em machines.status — os demais (CPU, disco, antivírus,
// firewall, ativação, RAM do servidor etc.) só entram em machine_alerts,
// sem afetar o badge online/offline da tela de Ativos.
const (
	alertaAgenteOffline   = "Agente Offline"
	alertaServidorOffline = "Servidor Debian Offline"
)

func afetaStatusDaMaquina(alertType string) bool {
	return alertType == alertaAgenteOffline || alertType == alertaServidorOffline
}

// monitoringCapacity expõe pro Grafana o quanto o projeto Supabase já
// consumiu dos tetos do plano.
//
// Existe porque o primeiro sinal de que um teto foi atingido, hoje, é o
// sistema já degradado: banco em somente-leitura ou conexão recusada, com
// todo o parque parando de reportar ao mesmo tempo. O alerta em 80% (ver
// grafana/provisioning/alerting/rules.yaml, grupo orion-supabase-capacity)
// dá margem pra agir antes disso.
//
// Autenticado pelo mesmo segredo do webhook de alertas — é o canal que já
// existe entre Grafana e Orion, e não valia inventar uma segunda variável de
// ambiente pra atravessar o mesmo caminho. Sem login de usuário: quem chama
// é o Grafana, não uma pessoa.
func monitoringCapacity(w http.ResponseWriter, r *http.Request) {
	ip := lib.ClientIP(r)
	if !limiterGrafanaWebhook.Permitir(ip) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

	const esquemaEsperado = "Bearer "
	auth := r.Header.Get("Authorization")
	secret := strings.TrimPrefix(auth, esquemaEsperado)
	if !strings.HasPrefix(auth, esquemaEsperado) || cfg.GrafanaWebhookSecret == "" || secret != cfg.GrafanaWebhookSecret {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	snapshot, err := db.Capacity(ctx)
	if err != nil {
		log.Printf("[ERRO] coletar capacidade: %v", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao coletar capacidade"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, snapshot)
}

func monitoringGrafanaAlertWebhook(w http.ResponseWriter, r *http.Request) {
	ip := lib.ClientIP(r)
	if !limiterGrafanaWebhook.Permitir(ip) {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "muitas requisições — aguarde e tente novamente"})
		return
	}

	const esquemaEsperado = "Bearer "
	auth := r.Header.Get("Authorization")
	secret := strings.TrimPrefix(auth, esquemaEsperado)
	if !strings.HasPrefix(auth, esquemaEsperado) || cfg.GrafanaWebhookSecret == "" || secret != cfg.GrafanaWebhookSecret {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var payload grafanaWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}

	processados := 0
	for _, alerta := range payload.Alerts {
		machineID := alerta.Labels["machine_id"]
		alertType := alerta.Labels["alertname"]
		if machineID == "" || alertType == "" {
			continue // sem machine_id (ex.: alerta de endpoint web/link) — fora de escopo aqui
		}

		switch alerta.Status {
		case "firing":
			severity := alerta.Labels["severity"]
			if severity == "" {
				severity = "warning"
			}
			message := alerta.Annotations["summary"]
			if message == "" {
				message = alerta.Annotations["description"]
			}
			if message == "" {
				message = alertType
			}
			if err := db.InsertAlertIfNotExists(ctx, lib.InsertAlertInput{
				MachineID: machineID, Type: alertType, Severity: severity, Message: message,
			}); err != nil {
				log.Printf("[GRAFANA-WEBHOOK] erro ao inserir alerta %s/%s: %v", machineID, alertType, err)
				continue
			}
			if afetaStatusDaMaquina(alertType) {
				if err := db.UpdateMachine(ctx, machineID, map[string]any{"status": "offline"}); err != nil {
					log.Printf("[GRAFANA-WEBHOOK] erro ao marcar máquina %s como offline: %v", machineID, err)
				}
			}
			if alertType == alertaServidorOffline {
				m, err := db.MachineByID(ctx, machineID)
				if err == nil && m != nil && m.DeviceType != nil && *m.DeviceType == "server" && m.CompanyID != nil {
					tok := ""
					if m.MachineToken != nil {
						tok = *m.MachineToken
					}
					_ = db.AbrirChamadoAlertaServidor(ctx, machineID, *m.CompanyID, tok, m.Hostname, alertaServidorOffline, "critical", "Servidor offline detectado pelo monitoramento")
				}
			}
		case "resolved":
			if err := db.ResolveAlertsByType(ctx, machineID, alertType); err != nil {
				log.Printf("[GRAFANA-WEBHOOK] erro ao resolver alerta %s/%s: %v", machineID, alertType, err)
				continue
			}
			if afetaStatusDaMaquina(alertType) {
				if err := db.UpdateMachine(ctx, machineID, map[string]any{"status": "online"}); err != nil {
					log.Printf("[GRAFANA-WEBHOOK] erro ao marcar máquina %s como online: %v", machineID, err)
				}
			}
			if alertType == alertaServidorOffline {
				_ = db.ResolverChamadoAlertaServidor(ctx, machineID, alertaServidorOffline)
			}
		default:
			continue
		}
		processados++
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "processed": processados})
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
