package monitor

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

// Store é o que o servidor precisa do banco. Interface para os testes do
// servidor rodarem sem Postgres.
type Store interface {
	Gravar(ctx context.Context, a *Amostra, abertos []Alerta, normais []string) error
	UltimasAmostras(ctx context.Context) ([]Amostra, error)
	Pronto(ctx context.Context) error
}

// PgStore grava no Postgres próprio do Monitor.
type PgStore struct {
	pool *pgxpool.Pool
}

func NovoPgStore(ctx context.Context, databaseURL string) (*PgStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("conectar ao banco do monitor: %w", err)
	}
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("aplicar schema do monitor: %w", err)
	}
	return &PgStore{pool: pool}, nil
}

func (s *PgStore) Close() { s.pool.Close() }

func (s *PgStore) Pronto(ctx context.Context) error { return s.pool.Ping(ctx) }

func jsonOuNulo(r json.RawMessage) any {
	if len(r) == 0 || string(r) == "null" {
		return nil
	}
	return string(r)
}

// Gravar persiste uma amostra numa transação só: estado atual, inventário (só
// se mudou) e alertas.
func (s *PgStore) Gravar(ctx context.Context, a *Amostra, abertos []Alerta, normais []string) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// O WHERE no DO UPDATE descarta amostra mais velha que a gravada: com
	// repasse e reenvio, uma amostra atrasada não pode voltar o relógio.
	if _, err := tx.Exec(ctx, `
INSERT INTO maquina_estado (machine_id, company_id, hostname, device_type, agent_version, os, os_version, ip, current_user_,
                            cpu_pct, ram_used, ram_total, disk_used, disk_total, uptime_s, visto_em)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
ON CONFLICT (machine_id) DO UPDATE SET
  company_id=$2, hostname=$3, device_type=$4, agent_version=$5, os=$6, os_version=$7, ip=$8, current_user_=$9,
  cpu_pct=$10, ram_used=$11, ram_total=$12, disk_used=$13, disk_total=$14, uptime_s=$15, visto_em=$16, atualizado_em=now()
WHERE maquina_estado.visto_em <= $16`,
		a.MachineID, a.CompanyID, a.Hostname, a.DeviceType, a.AgentVersion, a.OS, a.OSVersion, a.IP, a.CurrentUser,
		a.CPUUsage, a.RAMUsed, a.RAMTotal, a.DiskUsed, a.DiskTotal, a.Uptime, a.RecebidaEm); err != nil {
		return fmt.Errorf("gravar estado: %w", err)
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO maquina_hardware (machine_id, cpu_model, gpu, disks, interfaces, security_info, remote_software, battery_info, update_status)
VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb)
ON CONFLICT (machine_id) DO UPDATE SET
  cpu_model=$2, gpu=$3, disks=$4::jsonb, interfaces=$5::jsonb, security_info=$6::jsonb,
  remote_software=$7::jsonb, battery_info=$8::jsonb, update_status=$9::jsonb, atualizado_em=now()
WHERE (maquina_hardware.cpu_model, maquina_hardware.gpu, maquina_hardware.disks, maquina_hardware.interfaces,
       maquina_hardware.security_info, maquina_hardware.remote_software, maquina_hardware.battery_info,
       maquina_hardware.update_status)
  IS DISTINCT FROM ($2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)`,
		a.MachineID, a.CPUModel, a.GPU, jsonOuNulo(a.Disks), jsonOuNulo(a.Interfaces), jsonOuNulo(a.Security),
		jsonOuNulo(a.RemoteSoftware), jsonOuNulo(a.Battery), jsonOuNulo(a.UpdateStatus)); err != nil {
		return fmt.Errorf("gravar hardware: %w", err)
	}

	for _, al := range abertos {
		if _, err := tx.Exec(ctx, `
INSERT INTO maquina_alerta (machine_id, company_id, tipo, severidade, mensagem)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (machine_id, tipo) WHERE resolvido_em IS NULL DO NOTHING`,
			a.MachineID, a.CompanyID, al.Tipo, al.Severidade, al.Mensagem); err != nil {
			return fmt.Errorf("abrir alerta %s: %w", al.Tipo, err)
		}
	}
	if len(normais) > 0 {
		if _, err := tx.Exec(ctx, `
UPDATE maquina_alerta SET resolvido_em = now()
WHERE machine_id = $1 AND tipo = ANY($2) AND resolvido_em IS NULL`, a.MachineID, normais); err != nil {
			return fmt.Errorf("resolver alertas: %w", err)
		}
	}
	return tx.Commit(ctx)
}

// UltimasAmostras devolve o estado atual de todas as máquinas, para o
// /metrics voltar a ter dado logo depois de o serviço reiniciar.
func (s *PgStore) UltimasAmostras(ctx context.Context) ([]Amostra, error) {
	rows, err := s.pool.Query(ctx, `
SELECT machine_id::text, company_id::text, hostname, coalesce(device_type,''), coalesce(agent_version,''),
       coalesce(cpu_pct,0), coalesce(ram_used,0), coalesce(ram_total,0), coalesce(disk_used,0), coalesce(disk_total,0),
       coalesce(uptime_s,0), visto_em
FROM maquina_estado`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Amostra
	for rows.Next() {
		var a Amostra
		var cpu float32
		if err := rows.Scan(&a.MachineID, &a.CompanyID, &a.Hostname, &a.DeviceType, &a.AgentVersion,
			&cpu, &a.RAMUsed, &a.RAMTotal, &a.DiskUsed, &a.DiskTotal, &a.Uptime, &a.RecebidaEm); err != nil {
			return nil, err
		}
		a.CPUUsage = float64(cpu)
		out = append(out, a)
	}
	return out, rows.Err()
}
