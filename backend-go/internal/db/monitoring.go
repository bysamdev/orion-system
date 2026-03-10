package db

import (
	"context"
	"time"
)

// ============================================================
// Structs – Monitoring
// ============================================================

type MachineGroupRow struct {
	ID            string
	Name          string
	Description   *string
	ClientContact *string
	CreatedAt     time.Time
	TotalMachines int
	OnlineMachines int
}

type MachineRow struct {
	ID           string
	GroupID      *string
	Hostname     string
	IPAddress    *string
	OS           *string
	OSVersion    *string
	Status       string
	LastSeen     *time.Time
	AgentVersion *string
	CreatedAt    time.Time
}

type MachineWithMetric struct {
	MachineRow
	// último snapshot de métricas (pode ser zero-value se nenhuma métrica ainda)
	CPUUsage  *float64
	RAMTotal  *int64
	RAMUsed   *int64
	DiskTotal *int64
	DiskUsed  *int64
	Uptime    *int64
	CollectedAt *time.Time
}

type MetricRow struct {
	ID          string
	MachineID   string
	CPUUsage    *float64
	RAMTotal    *int64
	RAMUsed     *int64
	DiskTotal   *int64
	DiskUsed    *int64
	Uptime      *int64
	CollectedAt time.Time
}

type HardwareRow struct {
	ID        string
	MachineID string
	CPUModel  *string
	RAMSlots  []byte // JSONB raw
	Disks     []byte // JSONB raw
	GPU       *string
	UpdatedAt time.Time
}

type AlertRow struct {
	ID        string
	MachineID string
	Type      string
	Severity  string
	Message   string
	Resolved  bool
	CreatedAt time.Time
}

type DashboardSummary struct {
	Total        int
	Online       int
	Offline      int
	ActiveAlerts int
}

// ============================================================
// Queries
// ============================================================

// ListMachineGroups retorna todos os grupos + contagem de máquinas e quantas estão online.
func (d *DB) ListMachineGroups(ctx context.Context) ([]MachineGroupRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT
  mg.id::text,
  mg.name,
  mg.description,
  mg.client_contact,
  mg.created_at,
  COUNT(m.id)                                                AS total_machines,
  COUNT(m.id) FILTER (WHERE m.status = 'online')            AS online_machines
FROM public.machine_groups mg
LEFT JOIN public.machines m ON m.group_id = mg.id
GROUP BY mg.id
ORDER BY mg.name
`)
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

// MachinesByGroupID retorna as máquinas de um grupo com o último snapshot de métricas.
func (d *DB) MachinesByGroupID(ctx context.Context, groupID string) ([]MachineWithMetric, error) {
	rows, err := d.pool.Query(ctx, `
SELECT
  m.id::text,
  m.group_id::text,
  m.hostname,
  m.ip_address,
  m.os,
  m.os_version,
  m.status,
  m.last_seen,
  m.agent_version,
  m.created_at,
  lm.cpu_usage,
  lm.ram_total,
  lm.ram_used,
  lm.disk_total,
  lm.disk_used,
  lm.uptime,
  lm.collected_at
FROM public.machines m
LEFT JOIN LATERAL (
  SELECT cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at
  FROM public.machine_metrics
  WHERE machine_id = m.id
  ORDER BY collected_at DESC
  LIMIT 1
) lm ON true
WHERE m.group_id = $1
ORDER BY m.hostname
`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []MachineWithMetric
	for rows.Next() {
		var r MachineWithMetric
		if err := rows.Scan(
			&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
			&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt,
			&r.CPUUsage, &r.RAMTotal, &r.RAMUsed, &r.DiskTotal, &r.DiskUsed, &r.Uptime, &r.CollectedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// MachineByID retorna uma máquina pelo ID.
func (d *DB) MachineByID(ctx context.Context, id string) (*MachineRow, error) {
	var r MachineRow
	err := d.pool.QueryRow(ctx, `
SELECT id::text, group_id::text, hostname, ip_address, os, os_version,
       status, last_seen, agent_version, created_at
FROM public.machines
WHERE id = $1
`, id).Scan(&r.ID, &r.GroupID, &r.Hostname, &r.IPAddress, &r.OS, &r.OSVersion,
		&r.Status, &r.LastSeen, &r.AgentVersion, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// MachineHardwareByMachineID retorna o hardware de uma máquina.
func (d *DB) MachineHardwareByMachineID(ctx context.Context, machineID string) (*HardwareRow, error) {
	var r HardwareRow
	err := d.pool.QueryRow(ctx, `
SELECT id::text, machine_id::text, cpu_model, ram_slots, disks, gpu, updated_at
FROM public.machine_hardware
WHERE machine_id = $1
`, machineID).Scan(&r.ID, &r.MachineID, &r.CPUModel, &r.RAMSlots, &r.Disks, &r.GPU, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// MetricsByMachineID retorna o histórico de métricas de uma máquina (mais recentes primeiro).
func (d *DB) MetricsByMachineID(ctx context.Context, machineID string, limit int) ([]MetricRow, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at
FROM public.machine_metrics
WHERE machine_id = $1
ORDER BY collected_at DESC
LIMIT $2
`, machineID, limit)
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

// AlertsByMachineID retorna alertas não resolvidos de uma máquina.
func (d *DB) AlertsByMachineID(ctx context.Context, machineID string) ([]AlertRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT id::text, machine_id::text, type, severity, message, resolved, created_at
FROM public.machine_alerts
WHERE machine_id = $1 AND resolved = false
ORDER BY created_at DESC
`, machineID)
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

// UpsertMachine cria ou atualiza uma máquina pelo hostname.
// Retorna o ID (UUID texto) da máquina.
func (d *DB) UpsertMachine(ctx context.Context, hostname, ip, os, osVersion, agentVersion string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.machines (hostname, ip_address, os, os_version, status, last_seen, agent_version)
VALUES ($1, $2, $3, $4, 'online', now(), $5)
ON CONFLICT (hostname) DO UPDATE
  SET ip_address    = EXCLUDED.ip_address,
      os            = EXCLUDED.os,
      os_version    = EXCLUDED.os_version,
      status        = 'online',
      last_seen     = now(),
      agent_version = EXCLUDED.agent_version
RETURNING id::text
`, hostname, ip, os, osVersion, agentVersion).Scan(&id)
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

// InsertMetric grava um snapshot de métricas.
func (d *DB) InsertMetric(ctx context.Context, in InsertMetricInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_metrics
  (machine_id, cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime, collected_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, now())
`, in.MachineID, in.CPUUsage, in.RAMTotal, in.RAMUsed, in.DiskTotal, in.DiskUsed, in.Uptime)
	return err
}

type UpsertHardwareInput struct {
	MachineID string
	CPUModel  string
	RAMSlots  []byte // JSON
	Disks     []byte // JSON
	GPU       string
}

// UpsertHardware cria ou atualiza o registro de hardware da máquina.
func (d *DB) UpsertHardware(ctx context.Context, in UpsertHardwareInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_hardware (machine_id, cpu_model, ram_slots, disks, gpu, updated_at)
VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, now())
ON CONFLICT (machine_id) DO UPDATE
  SET cpu_model  = EXCLUDED.cpu_model,
      ram_slots  = EXCLUDED.ram_slots,
      disks      = EXCLUDED.disks,
      gpu        = EXCLUDED.gpu,
      updated_at = now()
`, in.MachineID, in.CPUModel, string(in.RAMSlots), string(in.Disks), in.GPU)
	return err
}

type InsertAlertInput struct {
	MachineID string
	Type      string
	Severity  string
	Message   string
}

// InsertAlert cria um alerta para uma máquina.
func (d *DB) InsertAlert(ctx context.Context, in InsertAlertInput) error {
	_, err := d.pool.Exec(ctx, `
INSERT INTO public.machine_alerts (machine_id, type, severity, message)
VALUES ($1, $2, $3, $4)
`, in.MachineID, in.Type, in.Severity, in.Message)
	return err
}

// DashboardSummaryData retorna contagens globais para o dashboard.
func (d *DB) DashboardSummaryData(ctx context.Context) (DashboardSummary, error) {
	var s DashboardSummary
	err := d.pool.QueryRow(ctx, `
SELECT
  COUNT(*)                                                        AS total,
  COUNT(*) FILTER (WHERE status = 'online')                      AS online,
  COUNT(*) FILTER (WHERE status = 'offline' OR status = 'unknown') AS offline
FROM public.machines
`).Scan(&s.Total, &s.Online, &s.Offline)
	if err != nil {
		return s, err
	}
	err = d.pool.QueryRow(ctx, `
SELECT COUNT(*) FROM public.machine_alerts WHERE resolved = false
`).Scan(&s.ActiveAlerts)
	return s, err
}

// MarkOfflineMachines marca como 'offline' máquinas cujo last_seen é mais antigo que 5 minutos.
func (d *DB) MarkOfflineMachines(ctx context.Context) (int64, error) {
	cmd, err := d.pool.Exec(ctx, `
UPDATE public.machines
SET status = 'offline'
WHERE status = 'online'
  AND last_seen < now() - INTERVAL '5 minutes'
`)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}
