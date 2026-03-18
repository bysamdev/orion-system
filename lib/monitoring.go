package lib

import (
	"context"
	"fmt"
	"time"
)

// ─── Structs ─────────────────────────────────────────────────────────────────

type MachineGroupRow struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	ClientContact  *string `json:"client_contact"`
	CreatedAt      time.Time `json:"created_at"`
	TotalMachines  int     `json:"total_machines"`
	OnlineMachines int     `json:"online_machines"`
}

type MachineRow struct {
	ID           string     `json:"id"`
	GroupID      *string    `json:"group_id"`
	Hostname     string     `json:"hostname"`
	IPAddress    *string    `json:"ip_address"`
	OS           *string    `json:"os"`
	OSVersion    *string    `json:"os_version"`
	Status       string     `json:"status"`
	LastSeen     *time.Time `json:"last_seen"`
	AgentVersion *string    `json:"agent_version"`
	CreatedAt    time.Time  `json:"created_at"`
	MachineToken *string    `json:"machine_token"`
	MachineUUID  *string    `json:"machine_uuid"`
	CurrentUser  *string    `json:"current_user"`
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
	ID                string    `json:"id"`
	MachineID         string    `json:"machine_id"`
	CPUModel          *string   `json:"cpu_model"`
	RAMSlots          []byte    `json:"ram_slots"`
	Disks             []byte    `json:"disks"`
	NetworkInterfaces []byte    `json:"network_interfaces"`
	GPU               *string   `json:"gpu"`
	UpdatedAt         time.Time `json:"updated_at"`
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
	AlertType   string     `json:"alert_type"`   // offline, disk, cpu, alert
	Severity    string     `json:"severity"`     // critical, warning
	Message     string     `json:"message"`
	MetricValue *float64   `json:"metric_value"` // % value when applicable
}

// ─── Queries ─────────────────────────────────────────────────────────────────

func (d *DB) ListMachineGroups(ctx context.Context) ([]MachineGroupRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT mg.id::text, mg.name, mg.description, mg.client_contact, mg.created_at,
       COUNT(m.id)                                              AS total_machines,
       COUNT(m.id) FILTER (WHERE m.status = 'online')          AS online_machines
FROM public.machine_groups mg
LEFT JOIN public.machines m ON m.group_id = mg.id
GROUP BY mg.id ORDER BY mg.name`)
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

func (d *DB) MachinesByGroupID(ctx context.Context, groupID string) ([]MachineWithMetric, error) {
	rows, err := d.pool.Query(ctx, `
SELECT m.id::text, m.group_id::text, m.hostname, m.ip_address, m.os, m.os_version,
       m.status, m.last_seen, m.agent_version, m.created_at,
       lm.cpu_usage, lm.ram_total, lm.ram_used, lm.disk_total, lm.disk_used, lm.uptime, lm.collected_at
FROM public.machines m
LEFT JOIN LATERAL (
  SELECT cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at
  FROM public.machine_metrics WHERE machine_id = m.id ORDER BY collected_at DESC LIMIT 1
) lm ON true
WHERE m.group_id = $1 ORDER BY m.hostname`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MachineWithMetric
	for rows.Next() {
		var r MachineWithMetric
		if err := rows.Scan(&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
			&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt,
			&r.CPUUsage, &r.RAMTotal, &r.RAMUsed, &r.DiskTotal, &r.DiskUsed, &r.Uptime, &r.CollectedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) MachineByID(ctx context.Context, id string) (*MachineRow, error) {
	var r MachineRow
	err := d.pool.QueryRow(ctx, `
SELECT id::text, group_id::text, hostname, ip_address, os, os_version,
       status, last_seen, agent_version, created_at
FROM public.machines WHERE id = $1`, id).Scan(
		&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
		&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *DB) MachineHardwareByMachineID(ctx context.Context, machineID string) (*HardwareRow, error) {
	var r HardwareRow
	err := d.pool.QueryRow(ctx, `
SELECT id::text, machine_id::text, cpu_model, ram_slots, disks, network_interfaces, gpu, updated_at
FROM public.machine_hardware WHERE machine_id = $1`, machineID).
		Scan(&r.ID, &r.MachineID, &r.CPUModel, &r.RAMSlots, &r.Disks, &r.NetworkInterfaces, &r.GPU, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *DB) MetricsByMachineID(ctx context.Context, machineID string, limit int) ([]MetricRow, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at
FROM public.machine_metrics WHERE machine_id = $1 ORDER BY collected_at DESC LIMIT $2`, machineID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MetricRow
	for rows.Next() {
		var r MetricRow
		if err := rows.Scan(&r.ID, &r.MachineID, &r.CPUUsage, &r.RAMTotal, &r.RAMUsed, &r.DiskTotal, &r.DiskUsed, &r.Uptime, &r.CollectedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
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

// GetOrCreateMachineGroup returns the group ID for the given domain and company.
// If the group doesn't exist, it creates it.
func (d *DB) GetOrCreateMachineGroup(ctx context.Context, domainName string, companyID string) (string, error) {
	var id string
	// Tenta buscar primeiro restringindo por empresa caso exista
	var query string
	var args []any
	if companyID != "" {
		query = `SELECT id::text FROM public.machine_groups WHERE name = $1 AND company_id = $2`
		args = []any{domainName, companyID}
	} else {
		query = `SELECT id::text FROM public.machine_groups WHERE name = $1 AND company_id IS NULL`
		args = []any{domainName}
	}

	err := d.pool.QueryRow(ctx, query, args...).Scan(&id)
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

func (d *DB) UpsertMachine(ctx context.Context, groupID, hostname, ip, osName, osVersion, agentVersion, machineToken, machineUUID, currentUser, companyID string) (string, error) {
	var id string
	
	// Format hostname as requested: Hostname - User - IP
	prettyHostname := hostname
	if currentUser != "" {
		prettyHostname += " - " + currentUser
	}
	if ip != "" {
		prettyHostname += " - " + ip
	}

	err := d.pool.QueryRow(ctx, `
INSERT INTO public.machines (group_id, hostname, ip_address, os, os_version, status, last_seen, agent_version, machine_token, machine_uuid, "current_user", company_id)
VALUES ($1, $2, $3, $4, $5, 'online', now(), $6, $7, $8, $9, $10)
ON CONFLICT (machine_token) DO UPDATE
  SET group_id=$1, hostname=$2, ip_address=$3, os=$4, os_version=$5, status='online', last_seen=now(), agent_version=$6, "current_user"=$9, company_id=$10
RETURNING id::text`, groupID, prettyHostname, ip, osName, osVersion, agentVersion, machineToken, NilIfEmpty(machineUUID), currentUser, NilIfEmpty(companyID)).Scan(&id)
	return id, err
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

func (d *DB) InsertMetric(ctx context.Context, in InsertMetricInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_metrics
  (machine_id, cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
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
}

func (d *DB) UpsertHardware(ctx context.Context, in UpsertHardwareInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_hardware (machine_id, cpu_model, ram_slots, disks, network_interfaces, gpu, updated_at)
VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, now())
ON CONFLICT (machine_id) DO UPDATE
  SET cpu_model=$2, ram_slots=$3::jsonb, disks=$4::jsonb, network_interfaces=$5::jsonb, gpu=$6, updated_at=now()`,
		in.MachineID, in.CPUModel, string(in.RAMSlots), string(in.Disks), string(in.NetworkInterfaces), in.GPU)
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

type InsertCommandInput struct {
	MachineID string
	Command   string
}

func (d *DB) CreateCommand(ctx context.Context, in InsertCommandInput) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.machine_commands (machine_id, command, status)
VALUES ($1, $2, 'pending') RETURNING id::text`, in.MachineID, in.Command).Scan(&id)
	return id, err
}

func (d *DB) GetPendingCommands(ctx context.Context, machineID string) ([]CommandRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, command, status, output, created_at, updated_at
FROM public.machine_commands WHERE machine_id = $1 AND status = 'pending'
ORDER BY created_at ASC`, machineID)
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

func (d *DB) DashboardSummaryData(ctx context.Context) (DashboardSummary, error) {
	var s DashboardSummary
	err := d.pool.QueryRow(ctx, `
SELECT 
  (SELECT COUNT(*) FROM public.machines) AS total,
  (SELECT COUNT(*) FROM public.machines WHERE status = 'online') AS online,
  (SELECT COUNT(*) FROM public.machines WHERE status <> 'online') AS offline,
  (SELECT COUNT(*) FROM public.machine_alerts WHERE resolved = false) AS active_alerts
`).Scan(&s.Total, &s.Online, &s.Offline, &s.ActiveAlerts)
	return s, err
}

func (d *DB) CriticalAlerts(ctx context.Context) ([]CriticalAlertItem, error) {
	rows, err := d.pool.Query(ctx, `
-- Máquinas offline há mais de 10 minutos
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'offline'::text AS alert_type, 'critical'::text AS severity,
       'Máquina offline há mais de 10 minutos' AS message,
       NULL::float8 AS metric_value
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE m.status = 'offline' AND m.last_seen < now() - INTERVAL '10 minutes'

UNION ALL

-- Disco acima de 90%
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'disk'::text, 'critical'::text,
       'Uso de disco acima de 90%',
       ROUND((lm.disk_used::float8 / NULLIF(lm.disk_total, 0)) * 100, 1)
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
LEFT JOIN LATERAL (
  SELECT disk_used, disk_total FROM public.machine_metrics
  WHERE machine_id = m.id ORDER BY collected_at DESC LIMIT 1
) lm ON true
WHERE lm.disk_total > 0 AND (lm.disk_used::float8 / lm.disk_total) > 0.90

UNION ALL

-- CPU acima de 85%
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'cpu'::text, 'warning'::text,
       'Uso de CPU acima de 85%',
       ROUND(lm.cpu_usage::float8, 1)
FROM public.machines m
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
LEFT JOIN LATERAL (
  SELECT cpu_usage FROM public.machine_metrics
  WHERE machine_id = m.id ORDER BY collected_at DESC LIMIT 1
) lm ON true
WHERE lm.cpu_usage > 85

UNION ALL

-- Alertas não resolvidos do sistema
SELECT m.id::text, m.hostname, mg.name, m.status, m.last_seen,
       'alert'::text, a.severity, a.message, NULL::float8
FROM public.machine_alerts a
JOIN public.machines m ON m.id = a.machine_id
LEFT JOIN public.machine_groups mg ON mg.id = m.group_id
WHERE a.resolved = false
ORDER BY severity DESC, alert_type
`)
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
WHERE status='online' AND last_seen < now() - INTERVAL '5 minutes'`)
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

func (d *DB) UpdateMachine(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	query := "UPDATE public.machines SET "
	var args []any
	i := 1
	for k, v := range updates {
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

func (d *DB) CreateMachineGroup(ctx context.Context, name, description, contact, companyID string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		INSERT INTO public.machine_groups (name, description, client_contact, company_id)
		VALUES ($1, $2, $3, $4) RETURNING id::text`, name, NilIfEmpty(description), NilIfEmpty(contact), NilIfEmpty(companyID)).Scan(&id)
	return id, err
}

func (d *DB) UpdateMachineGroup(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	query := "UPDATE public.machine_groups SET "
	var args []any
	i := 1
	for k, v := range updates {
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

