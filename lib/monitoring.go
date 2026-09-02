package lib

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─── Structs ─────────────────────────────────────────────────────────────────

type MachineGroupRow struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Description    *string   `json:"description"`
	ClientContact  *string   `json:"client_contact"`
	CreatedAt      time.Time `json:"created_at"`
	TotalMachines  int       `json:"total_machines"`
	OnlineMachines int       `json:"online_machines"`
}

type MachineRow struct {
	ID               string           `json:"id"`
	GroupID          *string          `json:"group_id"`
	CompanyID        *string          `json:"company_id"`
	Hostname         string           `json:"hostname"`
	IPAddress        *string          `json:"ip_address"`
	OS               *string          `json:"os"`
	OSVersion        *string          `json:"os_version"`
	Status           string           `json:"status"`
	LastSeen         *time.Time       `json:"last_seen"`
	AgentVersion     *string          `json:"agent_version"`
	ApprovalStatus   *string          `json:"approval_status,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	MachineToken     *string          `json:"machine_token"`
	MachineUUID      *string          `json:"machine_uuid"`
	CurrentUser      *string          `json:"current_user"`
	Domain           *string          `json:"domain"`
	MACAddress       *string          `json:"mac_address"`
	DeviceType       *string          `json:"device_type"`
	DeviceTypeReason *string          `json:"device_type_reason"`
	DeviceTypeLocked bool             `json:"device_type_locked"`
	SecurityInfo     *json.RawMessage `json:"security_info,omitempty"`
	RemoteSoftware   *json.RawMessage `json:"remote_software,omitempty"`
	BatteryInfo      *json.RawMessage `json:"battery_info,omitempty"`
	UpdateStatus     *json.RawMessage `json:"update_status,omitempty"`
}

type MachineWithMetric struct {
	MachineRow
	CPUUsage    *float64   `json:"cpu_usage"`
	RAMTotal    *int64     `json:"ram_total"`
	RAMUsed     *int64     `json:"ram_used"`
	DiskTotal   *int64     `json:"disk_total"`
	DiskUsed    *int64     `json:"disk_used"`
	Uptime      *int64     `json:"uptime"`
	CollectedAt *time.Time `json:"collected_at"`
}

type MetricRow struct {
	ID          string    `json:"id"`
	MachineID   string    `json:"machine_id"`
	CPUUsage    *float64  `json:"cpu_usage"`
	RAMTotal    *int64    `json:"ram_total"`
	RAMUsed     *int64    `json:"ram_used"`
	DiskTotal   *int64    `json:"disk_total"`
	DiskUsed    *int64    `json:"disk_used"`
	Uptime      *int64    `json:"uptime"`
	CollectedAt time.Time `json:"collected_at"`
}

type HardwareRow struct {
	ID        string  `json:"id"`
	MachineID string  `json:"machine_id"`
	CPUModel  *string `json:"cpu_model"`
	// RAMSlots/Disks/NetworkInterfaces precisam ser json.RawMessage, não
	// []byte puro: encoding/json serializa []byte como string base64 (padrão
	// da stdlib), então essas colunas jsonb chegavam ilegíveis no front-end
	// (Array.isArray(hw.disks) sempre falso, "Armazenamento & Partições" e
	// "Interfaces de Rede" sempre vazios mesmo com dado presente no banco —
	// ver TestHardwareRowSerializaDisksComoArrayJSON).
	RAMSlots          json.RawMessage  `json:"ram_slots"`
	Disks             json.RawMessage  `json:"disks"`
	NetworkInterfaces json.RawMessage  `json:"network_interfaces"`
	GPU               *string          `json:"gpu"`
	SecurityInfo      *json.RawMessage `json:"security_info,omitempty"`
	RemoteSoftware    *json.RawMessage `json:"remote_software,omitempty"`
	BatteryInfo       *json.RawMessage `json:"battery_info,omitempty"`
	UpdateStatus      *json.RawMessage `json:"update_status,omitempty"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

type AlertRow struct {
	ID        string    `json:"id"`
	MachineID string    `json:"machine_id"`
	Type      string    `json:"type"`
	Severity  string    `json:"severity"`
	Message   string    `json:"message"`
	Resolved  bool      `json:"resolved"`
	CreatedAt time.Time `json:"created_at"`
}

type CommandRow struct {
	ID        string    `json:"id"`
	MachineID string    `json:"machine_id"`
	Command   string    `json:"command"`
	Status    string    `json:"status"`
	Output    *string   `json:"output"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DashboardSummary struct {
	Total        int `json:"total"`
	Online       int `json:"online"`
	Offline      int `json:"offline"`
	ActiveAlerts int `json:"active_alerts"`
}

// CriticalAlertItem representa uma situação que requer atenção imediata do técnico.
type CriticalAlertItem struct {
	MachineID   string     `json:"machine_id"`
	Hostname    string     `json:"hostname"`
	GroupName   *string    `json:"group_name"`
	Status      string     `json:"status"`
	LastSeen    *time.Time `json:"last_seen"`
	AlertType   string     `json:"alert_type"` // offline, disk, cpu, alert
	Severity    string     `json:"severity"`   // critical, warning
	Message     string     `json:"message"`
	MetricValue *float64   `json:"metric_value"` // % value when applicable
}

// ─── Queries ─────────────────────────────────────────────────────────────────

// ListMachineGroups lista os grupos visíveis ao chamador.
//
// companyID nil = sem filtro (empresa master / developer). Caso contrário só os
// grupos daquela empresa, e a contagem de máquinas também é restrita a ela —
// senão os totais entregariam o tamanho do parque das outras empresas.
func (d *DB) ListMachineGroups(ctx context.Context, companyID *string) ([]MachineGroupRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT MAX(mg.id::text) AS id, mg.name, MAX(mg.description), MAX(mg.client_contact), MIN(mg.created_at),
       COUNT(m.id)                                              AS total_machines,
       COUNT(m.id) FILTER (WHERE m.status = 'online' OR m.status = 'alerta' OR (m.last_seen > NOW() - INTERVAL '5 minutes')) AS online_machines
FROM public.machine_groups mg
LEFT JOIN public.machines m
       ON m.group_id = mg.id
      AND ($1::uuid IS NULL OR m.company_id = $1::uuid)
WHERE $1::uuid IS NULL OR mg.company_id = $1::uuid
GROUP BY mg.name ORDER BY mg.name`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MachineGroupRow
	for rows.Next() {
		var r MachineGroupRow
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.ClientContact, &r.CreatedAt, &r.TotalMachines, &r.OnlineMachines); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// MachinesByGroupID lista as máquinas de um grupo. companyID nil = sem filtro.
func (d *DB) MachinesByGroupID(ctx context.Context, groupID string, companyID *string) ([]MachineWithMetric, error) {
	// O snapshot de CPU/RAM/disco vem direto das colunas de machines (ver
	// UpdateMachineSnapshot), não mais de um LEFT JOIN LATERAL em
	// machine_metrics — essa tabela parou de crescer a cada heartbeat; o
	// histórico de série temporal agora vive no Prometheus/Grafana (ver
	// lib/grafana_metrics.go).
	rows, err := d.pool.Query(ctx, `
SELECT m.id::text, m.group_id::text, m.hostname, m.ip_address, m.os, m.os_version,
       m.status, m.last_seen, m.agent_version, m.created_at,
       CASE
         WHEN m.domain IS NOT NULL AND m.domain <> 'WORKGROUP' AND m.domain <> 'NT SERVICE' AND m.domain <> 'local' AND m.domain <> m.hostname THEN m.domain
         WHEN mg.name IS NOT NULL THEN mg.name
         ELSE 'Geral'
       END AS domain,
       m.mac_address, m.current_user,
       hw.security_info,
       m.cpu_usage, m.ram_total, m.ram_used, m.disk_total, m.disk_used, m.uptime, m.metrics_collected_at
FROM public.machines m
JOIN public.machine_groups mg ON mg.id = m.group_id
LEFT JOIN public.machine_hardware hw ON hw.machine_id = m.id
WHERE mg.name = (SELECT name FROM public.machine_groups WHERE id = $1)
  AND m.approval_status = 'approved'
  AND ($2::uuid IS NULL OR m.company_id = $2::uuid)
ORDER BY m.hostname`, groupID, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MachineWithMetric
	for rows.Next() {
		var r MachineWithMetric
		// remote_software/battery_info/update_status ficam de fora desta
		// listagem (Correção A.15, PERFORMANCE.md §4.2): nenhuma tela que
		// renderiza a listagem de máquinas (MachineCard.tsx) lê esses três
		// campos — só o drawer de detalhe lê, e já busca o próprio hardware
		// completo via monitoringMachineDetail/MachineHardwareByMachineID.
		// security_info continua aqui porque MachineCard usa direto pro
		// badge "Sem Antivírus" na grade. Isso tira 3 blobs JSONB do
		// payload de um polling que roda a cada ciclo pra N máquinas.
		if err := rows.Scan(&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
			&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt,
			&r.Domain, &r.MACAddress, &r.CurrentUser,
			&r.SecurityInfo,
			&r.CPUUsage, &r.RAMTotal, &r.RAMUsed, &r.DiskTotal, &r.DiskUsed, &r.Uptime, &r.CollectedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// AllMachines lista todas as máquinas aprovadas (de todos os grupos) numa
// única query — substitui o padrão anterior do front-end de 1 request por
// grupo (useAllMachines em useMonitoring.ts fazia Promise.all sobre
// MachinesByGroupID por grupo). companyID nil = todas as empresas.
func (d *DB) AllMachines(ctx context.Context, companyID *string) ([]MachineWithMetric, error) {
	rows, err := d.pool.Query(ctx, `
SELECT m.id::text, m.group_id::text, m.hostname, m.ip_address, m.os, m.os_version,
       m.status, m.last_seen, m.agent_version, m.created_at,
       CASE
         WHEN m.domain IS NOT NULL AND m.domain <> 'WORKGROUP' AND m.domain <> 'NT SERVICE' AND m.domain <> 'local' AND m.domain <> m.hostname THEN m.domain
         WHEN mg.name IS NOT NULL THEN mg.name
         ELSE 'Geral'
       END AS domain,
       m.mac_address, m.current_user,
       hw.security_info,
       m.cpu_usage, m.ram_total, m.ram_used, m.disk_total, m.disk_used, m.uptime, m.metrics_collected_at
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
LEFT JOIN public.machine_hardware hw ON hw.machine_id = m.id
WHERE m.approval_status = 'approved'
  AND ($1::uuid IS NULL OR m.company_id = $1::uuid)
ORDER BY m.hostname`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MachineWithMetric
	for rows.Next() {
		var r MachineWithMetric
		if err := rows.Scan(&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
			&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt,
			&r.Domain, &r.MACAddress, &r.CurrentUser,
			&r.SecurityInfo,
			&r.CPUUsage, &r.RAMTotal, &r.RAMUsed, &r.DiskTotal, &r.DiskUsed, &r.Uptime, &r.CollectedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// MachineGhostEmail deriva o e-mail-fantasma que identifica a sessão do
// usuário-fantasma de uma máquina (ver machineLogin, handler/auth_handlers.go)
// a partir do machine_token — mesma lógica usada ali, extraída pra cá pra
// não duplicar quando outro ponto do backend precisa resolver "qual
// usuário-fantasma pertence a esta máquina" (ver
// monitoringMachineTickets: histórico de chamados por máquina, que
// reaproveita esse e-mail pra achar o user_id sem precisar de nenhuma
// coluna nova ligando machines a profiles).
func MachineGhostEmail(token string) string {
	prefix := token
	if len(token) > 12 {
		prefix = token[:12]
	}
	return strings.ToLower(fmt.Sprintf("machine-%s@orion.internal", prefix))
}

// MachineTokenAndCompanyByID busca só o machine_token e a company_id de uma
// máquina — nunca exposto em nenhuma resposta JSON pro front-end (ao
// contrário de MachineByID/MachineRow, que o painel lê direto); existe só
// pro uso interno do backend precisar recalcular MachineGhostEmail sem
// arriscar esse token vazar pra fora por engano.
func (d *DB) MachineTokenAndCompanyByID(ctx context.Context, id string) (token string, companyID *string, err error) {
	err = d.pool.QueryRow(ctx, `SELECT machine_token, company_id::text FROM public.machines WHERE id = $1`, id).Scan(&token, &companyID)
	return token, companyID, err
}

func (d *DB) MachineByID(ctx context.Context, id string) (*MachineRow, error) {
	var r MachineRow
	err := d.pool.QueryRow(ctx, `
SELECT m.id::text, m.group_id::text, m.company_id::text, m.hostname, m.ip_address, m.os, m.os_version,
       m.status, m.last_seen, m.agent_version, m.approval_status, m.created_at,
       CASE
         WHEN m.domain IS NOT NULL AND m.domain <> 'WORKGROUP' AND m.domain <> 'NT SERVICE' AND m.domain <> 'local' AND m.domain <> m.hostname THEN m.domain
         WHEN mg.name IS NOT NULL THEN mg.name
         ELSE 'Geral'
       END AS domain,
       m.mac_address, m."current_user",
       m.device_type, m.device_type_reason, m.device_type_locked
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE m.id = $1`, id).Scan(
		&r.ID, &r.GroupID, &r.CompanyID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
		&r.Status, &r.LastSeen, &r.AgentVersion, &r.ApprovalStatus, &r.CreatedAt, &r.Domain, &r.MACAddress, &r.CurrentUser,
		&r.DeviceType, &r.DeviceTypeReason, &r.DeviceTypeLocked)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *DB) MachineHardwareByMachineID(ctx context.Context, machineID string) (*HardwareRow, error) {
	var r HardwareRow
	err := d.pool.QueryRow(ctx, `
SELECT id::text, machine_id::text, cpu_model, ram_slots, disks, interfaces, gpu,
       security_info, remote_software, battery_info, update_status, updated_at
FROM public.machine_hardware WHERE machine_id = $1`, machineID).
		Scan(&r.ID, &r.MachineID, &r.CPUModel, &r.RAMSlots, &r.Disks, &r.NetworkInterfaces, &r.GPU,
			&r.SecurityInfo, &r.RemoteSoftware, &r.BatteryInfo, &r.UpdateStatus, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *DB) AlertsByMachineID(ctx context.Context, machineID string) ([]AlertRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, type, severity, message, resolved, created_at
FROM public.machine_alerts WHERE machine_id = $1 AND resolved = false ORDER BY created_at DESC`, machineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AlertRow
	for rows.Next() {
		var r AlertRow
		if err := rows.Scan(&r.ID, &r.MachineID, &r.Type, &r.Severity, &r.Message, &r.Resolved, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetOrCreateMachineGroup returns the group ID for the given company/domain.
// If generic domain or WORKGROUP is provided, it assigns to the Company group.
func (d *DB) GetOrCreateMachineGroup(ctx context.Context, domainName string, companyID string) (string, error) {
	groupName := strings.TrimSpace(domainName)
	// "." é o que WTSQuerySessionInformation(WTSDomainName) devolve pra uma
	// sessão de conta local no Windows (sem domínio AD de verdade) — sem
	// tratar aqui, virava nome de grupo literal "." (bug real observado em
	// produção). O agente já foi corrigido pra nunca mais enviar isso, mas
	// esta checagem no backend protege também os agentes já instalados que
	// ainda não foram atualizados.
	isGenericDomain := groupName == "" || strings.EqualFold(groupName, "WORKGROUP") || strings.EqualFold(groupName, "NT SERVICE") || strings.EqualFold(groupName, "local") || groupName == "."

	if isGenericDomain && companyID != "" {
		var companyName string
		_ = d.pool.QueryRow(ctx, `SELECT name FROM public.companies WHERE id = $1`, companyID).Scan(&companyName)
		if companyName != "" {
			groupName = companyName
		} else {
			groupName = "Geral"
		}
	}

	if groupName == "" {
		groupName = "Geral"
	}

	var id string
	if companyID != "" {
		// Procura grupo com esse nome para a empresa, ou grupo principal da empresa
		err := d.pool.QueryRow(ctx, `
			SELECT id::text FROM public.machine_groups 
			WHERE (LOWER(name) = LOWER($1) OR LOWER(name) = LOWER((SELECT name FROM public.companies WHERE id = $2))) 
			  AND company_id = $2 
			ORDER BY created_at ASC LIMIT 1`, groupName, companyID).Scan(&id)
		if err == nil {
			return id, nil
		}

		err = d.pool.QueryRow(ctx, `
			INSERT INTO public.machine_groups (name, company_id, description)
			VALUES ($1, $2, 'Grupo da empresa sincronizado via token')
			RETURNING id::text`, groupName, companyID).Scan(&id)
		return id, err
	}

	err := d.pool.QueryRow(ctx, `SELECT id::text FROM public.machine_groups WHERE LOWER(name) = LOWER($1) AND company_id IS NULL LIMIT 1`, groupName).Scan(&id)
	if err == nil {
		return id, nil
	}

	// Se não achar, cria
	if companyID != "" {
		err = d.pool.QueryRow(ctx, `
			INSERT INTO public.machine_groups (name, company_id, description)
			VALUES ($1, $2, 'Grupo gerado automaticamente')
			RETURNING id::text`, domainName, companyID).Scan(&id)
	} else {
		err = d.pool.QueryRow(ctx, `
			INSERT INTO public.machine_groups (name, description)
			VALUES ($1, 'Grupo gerado automaticamente')
			RETURNING id::text`, domainName).Scan(&id)
	}

	return id, err
}

// PendingMachineRow é o subconjunto de colunas que o admin precisa pra
// decidir aprovar ou rejeitar uma máquina nunca vista antes — sem métricas
// nem hardware, que não fazem sentido pra uma máquina ainda não confiável.
type PendingMachineRow struct {
	ID           string    `json:"id"`
	Hostname     string    `json:"hostname"`
	IPAddress    *string   `json:"ip_address"`
	OS           *string   `json:"os"`
	Domain       *string   `json:"domain"`
	CurrentUser  *string   `json:"current_user"`
	AgentVersion *string   `json:"agent_version"`
	CreatedAt    time.Time `json:"created_at"`
}

// PendingMachines lista máquinas aguardando aprovação manual (ver migration
// add_machine_approval_gate). companyID nil = todas as empresas.
func (d *DB) PendingMachines(ctx context.Context, companyID *string) ([]PendingMachineRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT id::text, hostname, ip_address, os, domain, "current_user", agent_version, created_at
FROM public.machines
WHERE approval_status = 'pending' AND ($1::uuid IS NULL OR company_id = $1::uuid)
ORDER BY created_at DESC`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PendingMachineRow
	for rows.Next() {
		var r PendingMachineRow
		if err := rows.Scan(&r.ID, &r.Hostname, &r.IPAddress, &r.OS, &r.Domain, &r.CurrentUser, &r.AgentVersion, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ApproveMachine libera uma máquina pendente pra aparecer no painel e nos
// contadores de dashboard. companyID nil = sem checagem de tenant (chamador
// já validado como escopo global); caso contrário restringe à empresa do
// chamador (SEC-02).
func (d *DB) ApproveMachine(ctx context.Context, machineID string, companyID *string) error {
	cmd, err := d.pool.Exec(ctx, `
UPDATE public.machines SET approval_status = 'approved'
WHERE id = $1 AND approval_status = 'pending' AND ($2::uuid IS NULL OR company_id = $2::uuid)`,
		machineID, companyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("máquina não encontrada ou já não está pendente")
	}
	return nil
}

// RejectMachine marca definitivamente uma máquina pendente como 'rejected'.
// Mantida no banco para auditoria e para impedir que heartbeats subsequentes
// reencarnem a máquina como pendente. companyID nil = sem checagem de tenant.
func (d *DB) RejectMachine(ctx context.Context, machineID string, companyID *string) error {
	cmd, err := d.pool.Exec(ctx, `
UPDATE public.machines
SET approval_status = 'rejected', status = 'offline', updated_at = now()
WHERE id = $1 AND approval_status = 'pending' AND ($2::uuid IS NULL OR company_id = $2::uuid)`,
		machineID, companyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("máquina não encontrada ou já não está pendente")
	}
	return nil
}

// DeleteMachine remove fisicamente uma máquina do parque (CASCADE cuida de hardware,
// alertas, comandos etc.). companyID nil = sem checagem de tenant.
func (d *DB) DeleteMachine(ctx context.Context, machineID string, companyID *string) error {
	cmd, err := d.pool.Exec(ctx, `
DELETE FROM public.machines
WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2::uuid)`,
		machineID, companyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("máquina não encontrada ou acesso não autorizado")
	}
	return nil
}

// UpsertMachine grava/atualiza o estado de identidade da máquina a partir de
// um heartbeat, numa transação: além do id, devolve o device_type
// efetivamente gravado (já considerando um eventual override travado — ver
// device_type_locked) e o approval_status atual.
func (d *DB) UpsertMachine(ctx context.Context, groupID, hostname, ip, osName, osVersion, agentVersion, machineToken, machineUUID, currentUser, currentUserSID, companyID, deviceType, macAddress, domain, deviceTypeReason string) (id, resolvedDeviceType, approvalStatus string, err error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return "", "", "", err
	}
	defer tx.Rollback(ctx)

	// Salva apenas o Hostname puro da máquina (sem IP ou usuário concatenados)
	cleanHostname := strings.TrimSpace(hostname)
	if idx := strings.Index(cleanHostname, " - "); idx != -1 {
		cleanHostname = strings.TrimSpace(cleanHostname[:idx])
	}

	if deviceType == "" {
		deviceType = "desktop"
	}

	var deviceTypeAntes *string
	err = tx.QueryRow(ctx, `
WITH machine_antes AS (
  SELECT device_type, approval_status FROM public.machines WHERE machine_token = $7
)
INSERT INTO public.machines (group_id, hostname, ip_address, os, os_version, status, last_seen, agent_version, machine_token, machine_uuid, "current_user", current_user_sid, company_id, local_ip, logged_in_user, mac_address, device_type, device_type_reason, domain)
VALUES ($1, $2, $3, $4, $5, 'online', now(), $6, $7, $8, $9, $10, $11, $3, $9, $12, $13, $15, $14)
ON CONFLICT (machine_token) DO UPDATE
  SET group_id = CASE WHEN machines.approval_status = 'rejected' THEN machines.group_id ELSE $1 END,
      hostname = CASE WHEN machines.approval_status = 'rejected' THEN machines.hostname ELSE $2 END,
      ip_address = CASE WHEN machines.approval_status = 'rejected' THEN machines.ip_address ELSE $3 END,
      os = CASE WHEN machines.approval_status = 'rejected' THEN machines.os ELSE $4 END,
      os_version = CASE WHEN machines.approval_status = 'rejected' THEN machines.os_version ELSE $5 END,
      status = CASE WHEN machines.approval_status = 'rejected' THEN 'offline' ELSE 'online' END,
      last_seen = CASE WHEN machines.approval_status = 'rejected' THEN machines.last_seen ELSE now() END,
      agent_version = CASE WHEN machines.approval_status = 'rejected' THEN machines.agent_version ELSE $6 END,
      "current_user" = CASE WHEN machines.approval_status = 'rejected' THEN machines."current_user" ELSE $9 END,
      current_user_sid = CASE WHEN machines.approval_status = 'rejected' THEN machines.current_user_sid ELSE $10 END,
      company_id = COALESCE(public.machines.company_id, $11),
      local_ip = CASE WHEN machines.approval_status = 'rejected' THEN machines.local_ip ELSE $3 END,
      logged_in_user = CASE WHEN machines.approval_status = 'rejected' THEN machines.logged_in_user ELSE $9 END,
      mac_address = CASE WHEN machines.approval_status = 'rejected' THEN machines.mac_address ELSE $12 END,
      device_type = CASE WHEN machines.device_type_locked THEN machines.device_type ELSE EXCLUDED.device_type END,
      device_type_reason = CASE WHEN machines.device_type_locked THEN machines.device_type_reason ELSE EXCLUDED.device_type_reason END,
      domain = CASE WHEN machines.approval_status = 'rejected' THEN machines.domain ELSE $14 END
RETURNING id::text, (SELECT device_type FROM machine_antes), device_type, approval_status::text`,
		groupID, cleanHostname, ip, osName, osVersion, agentVersion, machineToken, NilIfEmpty(machineUUID), currentUser, NilIfEmpty(currentUserSID), NilIfEmpty(companyID), NilIfEmpty(macAddress), deviceType, NilIfEmpty(domain), NilIfEmpty(deviceTypeReason),
	).Scan(&id, &deviceTypeAntes, &resolvedDeviceType, &approvalStatus)
	if err != nil {
		return "", "", "", err
	}

	// Registra a mudança só quando o device_type efetivamente gravado (já
	// considerando o lock acima) difere do que havia antes — cobre tanto a
	// primeira classificação de uma máquina nova (deviceTypeAntes == nil)
	// quanto uma reclassificação real; uma máquina travada que continua
	// recebendo um tipo diferente do agente NÃO gera entrada aqui, porque
	// resolvedDeviceType (o retorno da query, pós-CASE) preserva o valor
	// antigo nesse caso.
	if deviceTypeAntes == nil || *deviceTypeAntes != resolvedDeviceType {
		if _, err = tx.Exec(ctx, `
INSERT INTO public.machine_device_type_history (machine_id, old_type, new_type, reason, changed_by)
VALUES ($1, $2, $3, $4, 'agent')`,
			id, deviceTypeAntes, resolvedDeviceType, NilIfEmpty(deviceTypeReason)); err != nil {
			return "", "", "", err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return "", "", "", err
	}
	return id, resolvedDeviceType, approvalStatus, nil
}

// SetDeviceTypeOverride aplica uma correção manual de classificação de
// dispositivo (Fase 3 do plano de escalabilidade — "permitir override
// manual pelo Orion"): trava device_type_locked=true, para que o heartbeat
// do agente pare de sobrescrever esta máquina (ver UpsertMachine), e
// registra a mudança em machine_device_type_history com changed_by='manual'
// — só quando o tipo realmente muda, para não logar um "override" que
// repete o valor já vigente.
func (d *DB) SetDeviceTypeOverride(ctx context.Context, machineID, newType string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var oldType *string
	if err := tx.QueryRow(ctx, `SELECT device_type FROM public.machines WHERE id = $1`, machineID).Scan(&oldType); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `UPDATE public.machines SET device_type = $2, device_type_locked = true WHERE id = $1`, machineID, newType); err != nil {
		return err
	}

	if oldType == nil || *oldType != newType {
		if _, err := tx.Exec(ctx, `
INSERT INTO public.machine_device_type_history (machine_id, old_type, new_type, reason, changed_by)
VALUES ($1, $2, $3, 'override manual', 'manual')`, machineID, oldType, newType); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

type InsertMetricInput struct {
	MachineID string
	CPUUsage  float64
	RAMTotal  int64
	RAMUsed   int64
	DiskTotal int64
	DiskUsed  int64
	Uptime    int64
}

// UpdateMachineSnapshot grava o valor mais recente de CPU/RAM/disco direto na
// linha de machines (UPDATE, não INSERT) — substitui InsertMetric no caminho
// do heartbeat. O histórico de série temporal passou a viver no Prometheus/
// Grafana (ver lib/grafana_metrics.go); aqui fica só o "agora" que os cards
// de listagem precisam, sem crescer uma linha por heartbeat.
func (d *DB) UpdateMachineSnapshot(ctx context.Context, in InsertMetricInput) error {
	_, err := d.pool.Exec(ctx, `
UPDATE public.machines
SET cpu_usage = $2, ram_total = $3, ram_used = $4, disk_total = $5, disk_used = $6, uptime = $7, metrics_collected_at = now()
WHERE id = $1`,
		in.MachineID, in.CPUUsage, in.RAMTotal, in.RAMUsed, in.DiskTotal, in.DiskUsed, in.Uptime)
	return err
}

type UpsertHardwareInput struct {
	MachineID         string
	CPUModel          string
	RAMSlots          []byte
	Disks             []byte
	NetworkInterfaces []byte
	GPU               string
	SecurityInfo      []byte
	RemoteSoftware    []byte
	BatteryInfo       []byte
	UpdateStatus      []byte
}

func (d *DB) UpsertHardware(ctx context.Context, in UpsertHardwareInput) error {
	ramSlots := string(in.RAMSlots)
	if len(in.RAMSlots) == 0 {
		ramSlots = "null"
	}
	disks := string(in.Disks)
	if len(in.Disks) == 0 {
		disks = "[]"
	}
	ifaces := string(in.NetworkInterfaces)
	if len(in.NetworkInterfaces) == 0 {
		ifaces = "[]"
	}
	secInfo := string(in.SecurityInfo)
	if len(in.SecurityInfo) == 0 {
		secInfo = "null"
	}
	remoteSoft := string(in.RemoteSoftware)
	if len(in.RemoteSoftware) == 0 {
		remoteSoft = "null"
	}
	battery := string(in.BatteryInfo)
	if len(in.BatteryInfo) == 0 {
		battery = "null"
	}
	upStatus := string(in.UpdateStatus)
	if len(in.UpdateStatus) == 0 {
		upStatus = "null"
	}

	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_hardware (machine_id, cpu_model, ram_slots, disks, interfaces, gpu, security_info, remote_software, battery_info, update_status, updated_at)
VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, now())
ON CONFLICT (machine_id) DO UPDATE
  SET cpu_model=$2, ram_slots=$3::jsonb, disks=$4::jsonb, interfaces=$5::jsonb, gpu=$6, security_info=$7::jsonb, remote_software=$8::jsonb, battery_info=$9::jsonb, update_status=$10::jsonb, updated_at=now()`,
		in.MachineID, in.CPUModel, ramSlots, disks, ifaces, in.GPU, secInfo, remoteSoft, battery, upStatus)
	return err
}

type InsertAlertInput struct {
	MachineID string
	Type      string
	Severity  string
	Message   string
}

func (d *DB) InsertAlert(ctx context.Context, in InsertAlertInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_alerts (machine_id, type, severity, message)
VALUES ($1, $2, $3, $4)`, in.MachineID, in.Type, in.Severity, in.Message)
	return err
}

func (d *DB) InsertAlertIfNotExists(ctx context.Context, in InsertAlertInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_alerts (machine_id, type, severity, message)
SELECT $1, $2, $3, $4
WHERE NOT EXISTS (
    SELECT 1 FROM public.machine_alerts 
    WHERE machine_id = $1 AND type = $2 AND resolved = false
)`, in.MachineID, in.Type, in.Severity, in.Message)
	return err
}

func (d *DB) ResolveAlertsByType(ctx context.Context, machineID, alertType string) error {
	_, err := d.pool.Exec(ctx, `
UPDATE public.machine_alerts 
SET resolved = true 
WHERE machine_id = $1 AND type = $2 AND resolved = false`, machineID, alertType)
	return err
}

func (d *DB) HasUnresolvedAlerts(ctx context.Context, machineID string) (bool, error) {
	var count int
	err := d.pool.QueryRow(ctx, `
SELECT COUNT(1) FROM public.machine_alerts 
WHERE machine_id = $1 AND resolved = false`, machineID).Scan(&count)
	return count > 0, err
}

func (d *DB) UpdateMachineStatus(ctx context.Context, machineID, status string) error {
	_, err := d.pool.Exec(ctx, `
UPDATE public.machines 
SET status = $2 
WHERE id = $1`, machineID, status)
	return err
}

type InsertCommandInput struct {
	MachineID        string
	Command          string
	ExecutedByUserID *string
	ExecutedByName   *string
}

func (d *DB) CreateCommand(ctx context.Context, in InsertCommandInput) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.machine_commands (machine_id, command, status, executed_by_user_id, executed_by_name)
VALUES ($1, $2, 'pending', $3, $4) RETURNING id::text`, in.MachineID, in.Command, NilIfEmpty(pointerToString(in.ExecutedByUserID)), NilIfEmpty(pointerToString(in.ExecutedByName))).Scan(&id)
	return id, err
}

func pointerToString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// CommandCompanyID returns the company_id associated with the machine that owns the command.
func (d *DB) CommandCompanyID(ctx context.Context, commandID string) (*string, error) {
	var companyID *string
	err := d.pool.QueryRow(ctx, `
SELECT m.company_id::text
FROM public.machine_commands c
JOIN public.machines m ON m.id = c.machine_id
WHERE c.id = $1`, commandID).Scan(&companyID)
	return companyID, err
}

// marcadorAutoUpdate identifica, dentro do texto do comando, um comando de
// auto-atualização gerado pelo próprio backend (ver monitoringHeartbeat) —
// não um "orion-install" comum disparado manualmente em Instaladores &
// Updates. Só serve pra HasPendingUpdateCommand não confundir os dois ao
// decidir se já existe uma atualização enfileirada.
const marcadorAutoUpdate = `--auto-update="true"`

// HasPendingUpdateCommand verifica se já existe um comando de
// auto-atualização enfileirado (pending ou dispatched, ou seja, ainda sem
// resposta) pra essa máquina — evita empilhar um novo comando a cada
// heartbeat (a cada IntervalSeconds, tipicamente 60s) enquanto o anterior
// ainda está em trânsito.
func (d *DB) HasPendingUpdateCommand(ctx context.Context, machineID string) (bool, error) {
	var existe bool
	err := d.pool.QueryRow(ctx, `
SELECT EXISTS(
  SELECT 1 FROM public.machine_commands
  WHERE machine_id = $1 AND status IN ('pending', 'dispatched', 'sent')
    AND command LIKE '%' || $2 || '%'
)`, machineID, marcadorAutoUpdate).Scan(&existe)
	return existe, err
}

// GetPendingCommands busca os comandos pendentes de uma máquina e já os
// marca como 'dispatched' na mesma query (UPDATE...RETURNING, atômico) —
// antes era um SELECT puro deixando status='pending', então dois polls
// (a cada 30s — ver commandTicker no agente) que caíssem antes do
// primeiro comando terminar de executar buscavam e RODAVAM o mesmo
// comando duas vezes em paralelo. Pra a maioria dos comandos isso já era
// arriscado; pra auto-atualização do próprio agente (que pode passar de
// 30s: download + parar serviço + trocar exe + subir de novo) virava dois
// instaladores mexendo no mesmo serviço/arquivo ao mesmo tempo.
func (d *DB) GetPendingCommands(ctx context.Context, machineID string) ([]CommandRow, error) {
	rows, err := d.pool.Query(ctx, `
UPDATE public.machine_commands
SET status = 'dispatched', updated_at = now()
WHERE machine_id = $1 AND status = 'pending'
RETURNING id::text, machine_id::text, command, status, output, created_at, updated_at`, machineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CommandRow
	for rows.Next() {
		var r CommandRow
		if err := rows.Scan(&r.ID, &r.MachineID, &r.Command, &r.Status, &r.Output, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) ListCommandsByMachineID(ctx context.Context, machineID string, limit int) ([]CommandRow, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, command, status, output, created_at, updated_at
FROM public.machine_commands WHERE machine_id = $1
ORDER BY created_at DESC LIMIT $2`, machineID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CommandRow
	for rows.Next() {
		var r CommandRow
		if err := rows.Scan(&r.ID, &r.MachineID, &r.Command, &r.Status, &r.Output, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) UpdateCommandStatus(ctx context.Context, id, status, output string) error {
	_, err := d.pool.Exec(ctx, `
UPDATE public.machine_commands
SET status = $2, output = $3, updated_at = now()
WHERE id = $1`, id, status, output)
	return err
}

// UpdateCommandsStatusBatch marca vários comandos com o mesmo status numa
// única query, em vez de um UPDATE por comando (usado no polling do
// agente, onde N comandos pendentes viravam N round-trips sequenciais).
func (d *DB) UpdateCommandsStatusBatch(ctx context.Context, ids []string, status string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := d.pool.Exec(ctx, `
UPDATE public.machine_commands
SET status = $2, updated_at = now()
WHERE id = ANY($1::uuid[])`, ids, status)
	return err
}

// DashboardSummaryData conta máquinas e alertas. companyID nil = todas as
// empresas (master/developer); caso contrário só a empresa do chamador.
func (d *DB) DashboardSummaryData(ctx context.Context, companyID *string) (DashboardSummary, error) {
	var s DashboardSummary
	err := d.pool.QueryRow(ctx, `
SELECT
  (SELECT COUNT(*) FROM public.machines
    WHERE approval_status = 'approved' AND ($1::uuid IS NULL OR company_id = $1::uuid)) AS total,
  (SELECT COUNT(*) FROM public.machines
    WHERE approval_status = 'approved' AND (status = 'online' OR status = 'alerta' OR (last_seen > NOW() - INTERVAL '5 minutes')) AND ($1::uuid IS NULL OR company_id = $1::uuid)) AS online,
  (SELECT COUNT(*) FROM public.machines
    WHERE approval_status = 'approved' AND NOT (status = 'online' OR status = 'alerta' OR (last_seen > NOW() - INTERVAL '5 minutes')) AND ($1::uuid IS NULL OR company_id = $1::uuid)) AS offline,
  (SELECT COUNT(*) FROM public.machine_alerts a
    JOIN public.machines m ON m.id = a.machine_id
    WHERE a.resolved = false AND m.approval_status = 'approved' AND ($1::uuid IS NULL OR m.company_id = $1::uuid)) AS active_alerts
`, companyID).Scan(&s.Total, &s.Online, &s.Offline, &s.ActiveAlerts)
	return s, err
}

// PlatformHealth agrega o estado da frota inteira, cross-tenant — "saúde da
// própria plataforma" (Fase 10 do plano de escalabilidade), não uma visão
// por cliente. Reaproveita a mesma definição de online/offline de
// DashboardSummaryData (status='online'/'alerta' OU heartbeat nos últimos 5
// minutos) de propósito: inventar um segundo critério aqui reabriria
// exatamente o tipo de divergência que a Fase 7 corrigiu no card de
// máquina.
type PlatformHealth struct {
	MachinesTotal                  int            `json:"machines_total"`
	MachinesOnline                 int            `json:"machines_online"`
	MachinesOffline                int            `json:"machines_offline"`
	MachinesAlerta                 int            `json:"machines_alerta"`
	MachinesByDeviceType           map[string]int `json:"machines_by_device_type"`
	AlertsOpen                     int            `json:"alerts_open"`
	CommandsPending                int            `json:"commands_pending"`
	OldestPendingCommandAgeSeconds *int64         `json:"oldest_pending_command_age_seconds"`
	RateLimitActiveBuckets         int            `json:"rate_limit_active_buckets"`
}

func (d *DB) PlatformHealth(ctx context.Context) (PlatformHealth, error) {
	var h PlatformHealth
	err := d.pool.QueryRow(ctx, `
SELECT
  (SELECT COUNT(*) FROM public.machines) AS total,
  (SELECT COUNT(*) FROM public.machines
    WHERE status = 'online' OR status = 'alerta' OR (last_seen > NOW() - INTERVAL '5 minutes')) AS online,
  (SELECT COUNT(*) FROM public.machines
    WHERE NOT (status = 'online' OR status = 'alerta' OR (last_seen > NOW() - INTERVAL '5 minutes'))) AS offline,
  (SELECT COUNT(*) FROM public.machines WHERE status = 'alerta') AS alerta,
  (SELECT COUNT(*) FROM public.machine_alerts WHERE resolved = false) AS alerts_open,
  (SELECT COUNT(*) FROM public.machine_commands WHERE status = 'pending') AS commands_pending,
  (SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))::bigint FROM public.machine_commands WHERE status = 'pending') AS oldest_pending_age,
  (SELECT COUNT(*) FROM public.rate_limit_counters WHERE window_start > now() - INTERVAL '1 minute') AS active_buckets
`).Scan(&h.MachinesTotal, &h.MachinesOnline, &h.MachinesOffline, &h.MachinesAlerta,
		&h.AlertsOpen, &h.CommandsPending, &h.OldestPendingCommandAgeSeconds, &h.RateLimitActiveBuckets)
	if err != nil {
		return h, err
	}

	rows, err := d.pool.Query(ctx, `SELECT COALESCE(device_type, 'unknown'), COUNT(*) FROM public.machines GROUP BY device_type`)
	if err != nil {
		return h, err
	}
	defer rows.Close()
	h.MachinesByDeviceType = map[string]int{}
	for rows.Next() {
		var deviceType string
		var count int
		if err := rows.Scan(&deviceType, &count); err != nil {
			return h, err
		}
		h.MachinesByDeviceType[deviceType] = count
	}
	return h, rows.Err()
}

// CriticalAlerts agrega offline/disco/CPU/alertas (incluindo antivírus, firewall, updates).
// companyID nil = todas as empresas; caso contrário cada ramo do UNION filtra por m.company_id.
func (d *DB) CriticalAlerts(ctx context.Context, companyID *string) ([]CriticalAlertItem, error) {
	rows, err := d.pool.Query(ctx, `
-- Máquinas offline há mais de 1 hora
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'offline'::text AS alert_type, 'critical'::text AS severity,
       'Máquina offline há mais de 1h' AS message,
       NULL::float8 AS metric_value
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE m.status = 'offline' AND m.last_seen < now() - INTERVAL '1 hour'
  AND m.approval_status = 'approved'
  AND ($1::uuid IS NULL OR m.company_id = $1::uuid)

UNION ALL

-- Disco acima de 90% (snapshot em machines, ver UpdateMachineSnapshot)
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'disk'::text, 'critical'::text,
       'Uso de disco acima de 90%',
       ROUND((m.disk_used::float8 / NULLIF(m.disk_total, 0)) * 100, 1)
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE m.disk_total > 0 AND (m.disk_used::float8 / m.disk_total) > 0.90
  AND m.approval_status = 'approved'
  AND ($1::uuid IS NULL OR m.company_id = $1::uuid)

UNION ALL

-- CPU acima de 85% (snapshot em machines, ver UpdateMachineSnapshot)
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'cpu'::text, 'warning'::text,
       'Uso de CPU acima de 85%',
       ROUND(m.cpu_usage::float8, 1)
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE m.cpu_usage > 85
  AND m.approval_status = 'approved'
  AND ($1::uuid IS NULL OR m.company_id = $1::uuid)

UNION ALL

-- Alertas não resolvidos do sistema (antivirus, firewall, etc.)
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       a.type::text AS alert_type, a.severity, a.message, NULL::float8
FROM public.machine_alerts a
JOIN public.machines m ON m.id = a.machine_id
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE a.resolved = false AND a.type <> 'updates'
  AND m.approval_status = 'approved'
  AND ($1::uuid IS NULL OR m.company_id = $1::uuid)
ORDER BY severity DESC, alert_type
`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CriticalAlertItem
	for rows.Next() {
		var r CriticalAlertItem
		if err := rows.Scan(&r.MachineID, &r.Hostname, &r.GroupName, &r.Status, &r.LastSeen,
			&r.AlertType, &r.Severity, &r.Message, &r.MetricValue); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) MarkOfflineMachines(ctx context.Context) (int64, error) {
	cmd, err := d.pool.Exec(ctx, `
UPDATE public.machines SET status='offline'
WHERE status <> 'offline' AND last_seen < now() - INTERVAL '5 minutes'`)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (d *DB) MachineCount(ctx context.Context) (int, error) {
	var count int
	err := d.pool.QueryRow(ctx, `SELECT count(*) FROM public.machines`).Scan(&count)
	return count, err
}

// updatableMachineColumns é a allow-list de colunas que UpdateMachine aceita
// escrever. Os chamadores atuais (handler/mon_handlers.go) já filtram as
// chaves antes de chegar aqui, mas a checagem também vive nesta função —
// como defesa em profundidade — porque a chave do map vai direto pra string
// SQL (fmt.Sprintf("%s = $%d", k, i)); sem allow-list aqui, um futuro
// chamador que esqueça de filtrar reabriria SQL injection via nome de coluna.
var updatableMachineColumns = map[string]bool{"group_id": true, "company_id": true, "hostname": true, "status": true}

func (d *DB) UpdateMachine(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	query := "UPDATE public.machines SET "
	var args []any
	i := 1
	for k, v := range updates {
		if !updatableMachineColumns[k] {
			return fmt.Errorf("coluna não permitida em UpdateMachine: %q", k)
		}
		if i > 1 {
			query += ", "
		}
		query += fmt.Sprintf("%s = $%d", k, i)
		args = append(args, v)
		i++
	}
	query += fmt.Sprintf(" WHERE id = $%d", i)
	args = append(args, id)
	_, err := d.pool.Exec(ctx, query, args...)
	return err
}

// RegistrarSessaoTerminalRemoto grava a trilha de auditoria de uma sessão de
// shell remoto (quem, quando, em qual máquina/empresa) em
// remote_terminal_sessions. Chamada dentro de autorizarTerminalBrowser antes
// do upgrade pra WebSocket — falha aqui impede a sessão de abrir (fail-closed,
// não é best-effort).
func (d *DB) RegistrarSessaoTerminalRemoto(ctx context.Context, machineID string, companyID *string, userID string) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.remote_terminal_sessions (machine_id, company_id, opened_by)
VALUES ($1, $2, $3)`, machineID, companyID, userID)
	return err
}

// InsertRemediationLogInput descreve um evento de autocura reportado pelo agente.
type InsertRemediationLogInput struct {
	MachineID string
	CompanyID *string // empresa dona da máquina; nil para máquina órfã/legada
	AlertType string
	Status    string // "success" | "failed"
	Output    string
}

// InsertRemediationLog registra o resultado de uma remediação automática.
//
// Vai para rmm_remediation_logs (a tabela criada para isso), não para tickets:
// public.tickets exige user_id, requester_name e category NOT NULL, e o evento
// de autocura é autenticado por chave de agente — não existe usuário por trás
// dele para satisfazer o FK de user_id.
func (d *DB) InsertRemediationLog(ctx context.Context, in InsertRemediationLogInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.rmm_remediation_logs (agent_id, company_id, alert_type, status, output)
VALUES ($1, $2, $3, $4, $5)`,
		in.MachineID, in.CompanyID, in.AlertType, in.Status, NilIfEmpty(in.Output))
	return err
}

// MachineGroupCompanyID retorna a empresa dona do grupo — usado para checar
// posse antes de update/delete (correção: essas rotas só validavam o papel do
// chamador, nunca se o grupo pertencia à empresa dele).
func (d *DB) MachineGroupCompanyID(ctx context.Context, id string) (*string, error) {
	var companyID *string
	err := d.pool.QueryRow(ctx, `SELECT company_id::text FROM public.machine_groups WHERE id = $1`, id).Scan(&companyID)
	return companyID, err
}

func (d *DB) CreateMachineGroup(ctx context.Context, name, description, contact, companyID string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		INSERT INTO public.machine_groups (name, description, client_contact, company_id)
		VALUES ($1, $2, $3, $4) RETURNING id::text`, name, NilIfEmpty(description), NilIfEmpty(contact), NilIfEmpty(companyID)).Scan(&id)
	return id, err
}

// updatableMachineGroupColumns — mesma lógica de defesa em profundidade de
// updatableMachineColumns, ver comentário acima.
var updatableMachineGroupColumns = map[string]bool{"name": true, "description": true, "client_contact": true, "company_id": true}

func (d *DB) UpdateMachineGroup(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	query := "UPDATE public.machine_groups SET "
	var args []any
	i := 1
	for k, v := range updates {
		if !updatableMachineGroupColumns[k] {
			return fmt.Errorf("coluna não permitida em UpdateMachineGroup: %q", k)
		}
		if i > 1 {
			query += ", "
		}
		query += fmt.Sprintf("%s = $%d", k, i)
		args = append(args, v)
		i++
	}
	query += fmt.Sprintf(" WHERE id = $%d", i)
	args = append(args, id)
	_, err := d.pool.Exec(ctx, query, args...)
	return err
}

func (d *DB) DeleteMachineGroup(ctx context.Context, id string) error {
	_, err := d.pool.Exec(ctx, `DELETE FROM public.machine_groups WHERE id = $1`, id)
	return err
}

// AbrirChamadoAlertaServidor cria um chamado na tabela public.tickets exclusivamente
// para alertas críticos em servidores (device_type == 'server'), com deduplicação estrita:
// se já houver chamado aberto para (machine_id, alert_type), nenhum novo é gerado.
func (d *DB) AbrirChamadoAlertaServidor(ctx context.Context, machineID, companyID, machineToken, hostname, alertType, severity, alertMessage string) error {
	if companyID == "" || machineID == "" {
		return nil
	}

	// 1. Deduplicação: verifica se já existe chamado em aberto para esta máquina e tipo de alerta
	var existente bool
	err := d.pool.QueryRow(ctx, `
SELECT EXISTS(
  SELECT 1 FROM public.tickets
  WHERE company_id = $1::uuid
    AND status NOT IN ('resolved', 'closed', 'cancelled')
    AND metadata->>'machine_id' = $2
    AND metadata->>'alert_type' = $3
)`, companyID, machineID, alertType).Scan(&existente)
	if err != nil {
		return fmt.Errorf("checar duplicidade de chamado: %w", err)
	}
	if existente {
		return nil // Já existe chamado em aberto; evita flapping e tempestade de chamados
	}

	// 2. Resolve o user_id para satisfazer FK public.tickets.user_id -> auth.users(id)
	// Tenta primeiro o e-mail fantasma da máquina; se não existir, pega o primeiro perfil da empresa.
	var userID string
	machineEmail := MachineGhostEmail(machineToken)
	userID, _ = d.AuthUserIDByEmail(ctx, machineEmail)

	if userID == "" {
		_ = d.pool.QueryRow(ctx, `
SELECT id::text FROM public.profiles
WHERE company_id = $1::uuid
ORDER BY created_at ASC LIMIT 1`, companyID).Scan(&userID)
	}
	if userID == "" {
		return fmt.Errorf("nenhum usuário disponível para atribuir a abertura do chamado automático na empresa %s", companyID)
	}

	priority := "high"
	if severity == "critical" {
		priority = "urgent"
	}

	title := fmt.Sprintf("[ALERTA RMM - Servidor %s] %s", hostname, alertMessage)
	if len(title) > 200 {
		title = title[:200]
	}

	description := fmt.Sprintf("Chamado gerado automaticamente pelo monitoramento Orion RMM.\n\nServidor: %s\nTipo de Alerta: %s\nSeveridade: %s\nMensagem: %s\nDetectado em: %s",
		hostname, alertType, severity, alertMessage, time.Now().Format("02/01/2006 15:04:05"))

	metaJSON, _ := json.Marshal(map[string]any{
		"machine_id":     machineID,
		"alert_type":     alertType,
		"severity":       severity,
		"auto_generated": true,
	})

	requesterName := fmt.Sprintf("Servidor %s (Orion RMM)", hostname)

	_, err = d.pool.Exec(ctx, `
INSERT INTO public.tickets (title, description, category, priority, status, user_id, company_id, requester_name, metadata)
VALUES ($1, $2, 'Infraestrutura', $3, 'open', $4::uuid, $5::uuid, $6, $7::jsonb)`,
		title, description, priority, userID, companyID, requesterName, metaJSON)
	if err != nil {
		return fmt.Errorf("inserir ticket automático de servidor: %w", err)
	}

	log.Printf("[RMM-SERVIDORES] Chamado automático aberto para servidor %s (%s): %s", hostname, alertType, alertMessage)
	return nil
}

// ResolverChamadoAlertaServidor resolve chamados automáticos em aberto quando o alerta do servidor normaliza.
func (d *DB) ResolverChamadoAlertaServidor(ctx context.Context, machineID, alertType string) error {
	if machineID == "" || alertType == "" {
		return nil
	}

	var ticketID, userID string
	err := d.pool.QueryRow(ctx, `
UPDATE public.tickets
SET status = 'resolved',
    resolved_at = now(),
    updated_at = now(),
    resolution_notes = 'Alerta normalizado automaticamente pelo Orion RMM.'
WHERE status NOT IN ('resolved', 'closed', 'cancelled')
  AND metadata->>'machine_id' = $1
  AND metadata->>'alert_type' = $2
RETURNING id::text, user_id::text`, machineID, alertType).Scan(&ticketID, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Nenhum chamado em aberto para esse alerta
		}
		return err
	}

	// Registra comentário interno no histórico do chamado
	_, _ = d.pool.Exec(ctx, `
INSERT INTO public.ticket_updates (ticket_id, author_id, author, content, type, is_internal, created_at)
VALUES ($1::uuid, $2::uuid, 'Orion RMM', 'Alerta de telemetria normalizado automaticamente pelo sistema de monitoramento.', 'status_change', true, now())`,
		ticketID, userID)

	log.Printf("[RMM-SERVIDORES] Chamado automático %s normalizado e resolvido para servidor %s (%s)", ticketID, machineID, alertType)
	return nil
}
