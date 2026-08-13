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

func (d *DB) Pool() *pgxpool.Pool { return d.pool }

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

func (d *DB) CompanyByUserID(ctx context.Context, userID string) (*string, error) {
	var companyID *string
	err := d.pool.QueryRow(ctx, `select company_id::text from public.profiles where id = $1 limit 1`, userID).Scan(&companyID)
	return companyID, err
}

// UserScope descreve até onde a leitura de um usuário pode enxergar no
// monitoramento multi-empresa.
//
// Existe porque o pool do backend conecta com papel privilegiado — RLS não se
// aplica a estas queries, então o recorte por empresa precisa ser feito aqui.
type UserScope struct {
	CompanyID *string // empresa do usuário; nil quando o perfil não tem empresa
	Role      string  // customer | technician | admin | developer
	Master    bool    // pertence à empresa master (Orion System)
}

// Global informa se o usuário enxerga todas as empresas. Espelha exatamente a
// condição usada nas policies de RLS em 20260614000001_enable_rls_machines.sql:
// is_master_company_user(uid) OR has_role(uid, 'developer').
func (s UserScope) Global() bool {
	return s.Master || s.Role == "developer"
}

// FiltroEmpresa devolve o valor a passar como parâmetro de company_id nas
// queries escopadas: nil para quem vê tudo (o SQL trata NULL como "sem filtro"),
// senão a empresa do usuário.
func (s UserScope) FiltroEmpresa() *string {
	if s.Global() {
		return nil
	}
	return s.CompanyID
}

// PodeVerEmpresa decide se o usuário pode ler um objeto de uma dada empresa.
// Um objeto sem company_id (dado órfão/legado) só é visível para quem vê tudo.
func (s UserScope) PodeVerEmpresa(companyID *string) bool {
	if s.Global() {
		return true
	}
	if companyID == nil || s.CompanyID == nil {
		return false
	}
	return *companyID == *s.CompanyID
}

// UserScopeByID resolve empresa, papel e pertencimento à empresa master numa
// única ida ao banco. LEFT JOIN em user_roles porque 'customer' é implícito:
// createUserCredentials só grava a linha quando o papel não é customer.
func (d *DB) UserScopeByID(ctx context.Context, userID string) (UserScope, error) {
	var s UserScope
	err := d.pool.QueryRow(ctx, `
SELECT p.company_id::text,
       COALESCE(ur.role::text, 'customer'),
       COALESCE(c.name = 'Orion System', false)
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.companies  c  ON c.id = p.company_id
WHERE p.id = $1
LIMIT 1`, userID).Scan(&s.CompanyID, &s.Role, &s.Master)
	return s, err
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
