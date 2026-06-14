package lib

import (
	"context"
	"errors"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps a pgx connection pool.
type DB struct {
	pool *pgxpool.Pool
}

// NewDB creates a new database connection pool.
func NewDB(databaseURL string) (*DB, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL está vazia")
	}

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Dialer customizado para lidar com IPv4/IPv6 de forma resiliente na Vercel
	dialer := &net.Dialer{
		KeepAlive: 5 * time.Minute,
	}
	cfg.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
		// Se o endereço for um IPv6 literal (ex: [2600:...]:5432), usamos tcp padrão (que resolve IPv6)
		// Caso contrário, tentamos forçar tcp4 para evitar erros comuns de resolução na Vercel
		if len(addr) > 0 && addr[0] == '[' {
			return dialer.DialContext(ctx, "tcp", addr)
		}
		return dialer.DialContext(ctx, "tcp4", addr)
	}
	
	cfg.MaxConns = 10
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second

	// PgBouncer em modo 'Transaction' não suporta Prepared Statements (protocolo estendido).
	// Forçamos o 'Simple Protocol' para evitar o erro "prepared statement already exists".
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, err
	}
	return &DB{pool: pool}, nil
}

func (d *DB) Close() { d.pool.Close() }

// ─── Auth / Profile ─────────────────────────────────────────────────────────

func (d *DB) RoleByUserID(ctx context.Context, userID string) (string, error) {
	var role string
	err := d.pool.QueryRow(ctx, `select role from public.user_roles where user_id = $1 limit 1`, userID).Scan(&role)
	return role, err
}

func (d *DB) CompanyExists(ctx context.Context, companyID string) (bool, error) {
	var exists bool
	err := d.pool.QueryRow(ctx, `select exists(select 1 from public.companies where id = $1)`, companyID).Scan(&exists)
	return exists, err
}

type ProfileUpdate struct {
	FullName           *string
	Department         *string
	DepartmentProvided bool
	Email              *string
	CompanyID          *string
}

func (d *DB) UpdateProfile(ctx context.Context, userID string, u ProfileUpdate) error {
	_, err := d.pool.Exec(ctx, `
update public.profiles
set
  full_name  = coalesce($2, full_name),
  department = case when $6 then $3 else department end,
  email      = coalesce($4, email),
  company_id = coalesce($5, company_id)
where id = $1
`, userID, u.FullName, u.Department, u.Email, u.CompanyID, u.DepartmentProvided)
	return err
}

func (d *DB) UpdateUserRole(ctx context.Context, userID, role string) error {
	_, err := d.pool.Exec(ctx, `update public.user_roles set role = $2 where user_id = $1`, userID, role)
	return err
}

func (d *DB) ProfileByID(ctx context.Context, userID string) (email string, fullName *string, err error) {
	var fn *string
	var em string
	e := d.pool.QueryRow(ctx, `select email, full_name from public.profiles where id = $1`, userID).Scan(&em, &fn)
	return em, fn, e
}

func (d *DB) AuthUserIDByEmail(ctx context.Context, email string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `select id::text from auth.users where email = $1 limit 1`, email).Scan(&id)
	return id, err
}

type InviteToken struct {
	Email     string
	ExpiresAt time.Time
}

func (d *DB) InviteTokenByToken(ctx context.Context, token string) (*InviteToken, error) {
	var it InviteToken
	err := d.pool.QueryRow(ctx, `select email, expires_at from public.invite_tokens where token = $1 limit 1`, token).Scan(&it.Email, &it.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &it, nil
}

func (d *DB) DeleteInviteToken(ctx context.Context, token string) error {
	_, err := d.pool.Exec(ctx, `delete from public.invite_tokens where token = $1`, token)
	return err
}

type TicketRow struct {
	ID        string
	CreatedAt time.Time
}

func (d *DB) RecentTicketsByUser(ctx context.Context, userID string, since time.Time) ([]TicketRow, error) {
	rows, err := d.pool.Query(ctx, `
select id::text, created_at
from public.tickets
where user_id = $1 and created_at >= $2
order by created_at desc
`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TicketRow
	for rows.Next() {
		var r TicketRow
		if err := rows.Scan(&r.ID, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) TicketUUIDByNumber(ctx context.Context, number int) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `select id::text from public.tickets where ticket_number = $1 limit 1`, number).Scan(&id)
	return id, err
}

func (d *DB) EnsureProfileRowExists(ctx context.Context, userID string) error {
	var exists bool
	err := d.pool.QueryRow(ctx, `select exists(select 1 from public.profiles where id = $1)`, userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("profile ainda não existe")
	}
	return nil
}

// ValidateAPIKey checks if a key is valid and active, updating its last_used_at timestamp.
func (d *DB) ValidateAPIKey(ctx context.Context, keyValue string) (companyID string, err error) {
	err = d.pool.QueryRow(ctx, `
		UPDATE public.api_keys 
		SET last_used_at = now() 
		WHERE key_value = $1 AND is_active = true 
		RETURNING company_id::text`, keyValue).Scan(&companyID)
	return companyID, err
}

// CompanyByDomain retrieves a company ID by its registered domain.
func (d *DB) CompanyByDomain(ctx context.Context, domain string) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `SELECT id::text FROM public.companies WHERE domain = $1`, domain).Scan(&id)
	return id, err
}

// FirstCompanyID returns the ID of the first company found in the database.
// Used as a fallback when no specific company can be identified.
func (d *DB) FirstCompanyID(ctx context.Context) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `SELECT id::text FROM public.companies LIMIT 1`).Scan(&id)
	return id, err
}

// MachineByToken retrieves machine details by its unique token.
func (d *DB) MachineByToken(ctx context.Context, token string) (*MachineRow, string, error) {
	var m MachineRow
	var companyID string
	err := d.pool.QueryRow(ctx, `
		SELECT id::text, group_id::text, hostname, ip_address, os, os_version, status, last_seen, agent_version, created_at, company_id::text
		FROM public.machines WHERE machine_token = $1 LIMIT 1`, token).Scan(
		&m.ID, &m.GroupID, &m.Hostname, &m.IPAddress, &m.OS, &m.OSVersion, &m.Status, &m.LastSeen, &m.AgentVersion, &m.CreatedAt, &companyID,
	)
	if err != nil {
		return nil, "", err
	}
	return &m, companyID, nil
}

// ErrNoRows is a sentinel for pgx.ErrNoRows so callers don't need to import pgx.
var ErrNoRows = pgx.ErrNoRows
