package lib

import (
	"context"
	"errors"
	"net"
	"os"
	"strconv"
	"strings"
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
	
	// Dimensionamento dinâmico de conexões com suporte a PgBouncer
	maxConns := int32(25)
	if v := os.Getenv("DB_MAX_CONNS"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			maxConns = int32(parsed)
		}
	}
	cfg.MaxConns = maxConns

	minConns := int32(2)
	if v := os.Getenv("DB_MIN_CONNS"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed >= 0 {
			minConns = int32(parsed)
		}
	}
	cfg.MinConns = minConns

	idleTime := 5 * time.Minute
	if v := os.Getenv("DB_MAX_CONN_IDLE_TIME"); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			idleTime = parsed
		}
	}
	cfg.MaxConnIdleTime = idleTime

	lifetime := 30 * time.Minute
	if v := os.Getenv("DB_MAX_CONN_LIFETIME"); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			lifetime = parsed
		}
	}
	cfg.MaxConnLifetime = lifetime

	healthCheck := 30 * time.Second
	if v := os.Getenv("DB_HEALTH_CHECK_PERIOD"); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			healthCheck = parsed
		}
	}
	cfg.HealthCheckPeriod = healthCheck

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
}

// Global informa se o usuário enxerga todas as empresas.
//
// Por decisão de produto (por enquanto), technician/admin/developer têm visão
// MSP-wide independente da empresa a que pertencem — só o papel customer é
// restrito à própria empresa (ele só precisa ver seus próprios chamados).
// Antes disso era decidido por ILIKE no nome da empresa ("Orion System",
// "iBReady", "bysamdev") — qualquer papel, inclusive technician, virava
// global só por estar numa dessas empresas; achado real de auditoria E2E
// (técnico via máquinas de outro tenant). Trocado por checagem de papel.
func (s UserScope) Global() bool {
	return s.Role != "customer"
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

// UserScopeByID resolve empresa e papel do usuário numa única ida ao banco.
// LEFT JOIN em user_roles porque 'customer' é implícito: createUserCredentials
// só grava a linha quando o papel não é customer.
func (d *DB) UserScopeByID(ctx context.Context, userID string) (UserScope, error) {
	var s UserScope
	err := d.pool.QueryRow(ctx, `
SELECT p.company_id::text,
       COALESCE(ur.role::text, 'customer')
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = $1
LIMIT 1`, userID).Scan(&s.CompanyID, &s.Role)
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

// MergeUserData reatribui todos os dados de sourceID pra targetID (função
// SQL merge_user_data — revogada de anon/authenticated por design, só
// alcançável por quem conecta direto no Postgres com a connection string do
// backend, ver migration 20260820220000). Não apaga sourceID de auth.users
// nem profiles — isso é responsabilidade do chamador, via
// sb.AdminDeleteUserByID, depois que este UPDATE em massa terminar.
func (d *DB) MergeUserData(ctx context.Context, sourceID, targetID string) error {
	_, err := d.pool.Exec(ctx, `select merge_user_data($1::uuid, $2::uuid)`, sourceID, targetID)
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

// MachineTicketRow é o subconjunto de colunas que o histórico de chamados
// por máquina (ver monitoringMachineTickets, handler/mon_handlers.go)
// mostra — nada sensível, só o suficiente pra listar/identificar o
// chamado.
type MachineTicketRow struct {
	ID        string     `json:"id"`
	Number    int        `json:"ticket_number"`
	Title     string     `json:"title"`
	Status    string     `json:"status"`
	Priority  string     `json:"priority"`
	Category  *string    `json:"category"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

// TicketsByUserID lista os chamados abertos por um usuário específico —
// usado pelo histórico de chamados por MÁQUINA: como toda máquina sempre
// autentica pelo mesmo usuário-fantasma (ver MachineGhostEmail em
// lib/monitoring.go), userID aqui é o ID desse usuário-fantasma, e a
// listagem resultante é, na prática, "todo chamado aberto por qualquer
// pessoa que usou essa máquina" — sem precisar de nenhuma coluna nova
// ligando machines a tickets.
func (d *DB) TicketsByUserID(ctx context.Context, userID string, limit int) ([]MachineTicketRow, error) {
	rows, err := d.pool.Query(ctx, `
SELECT id::text, ticket_number, title, status, priority, category, created_at, updated_at, resolved_at
FROM public.tickets
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MachineTicketRow
	for rows.Next() {
		var r MachineTicketRow
		if err := rows.Scan(&r.ID, &r.Number, &r.Title, &r.Status, &r.Priority, &r.Category, &r.CreatedAt, &r.UpdatedAt, &r.ClosedAt); err != nil {
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

func (d *DB) TicketUUIDByNumberScoped(ctx context.Context, number int, companyFilter *string) (string, error) {
	var id string
	var err error
	if companyFilter != nil && *companyFilter != "" {
		err = d.pool.QueryRow(ctx, `select id::text from public.tickets where ticket_number = $1 and company_id = $2::uuid limit 1`, number, *companyFilter).Scan(&id)
	} else {
		err = d.pool.QueryRow(ctx, `select id::text from public.tickets where ticket_number = $1 limit 1`, number).Scan(&id)
	}
	return id, err
}

// TicketUUIDByIDScoped confirma que o ticket UUID existe e, se companyFilter
// não for nil/vazio, que pertence a essa empresa -- espelha
// TicketUUIDByNumberScoped pra fechar o mesmo caminho quando o ID informado
// já vem como UUID em vez de número.
func (d *DB) TicketUUIDByIDScoped(ctx context.Context, id string, companyFilter *string) (string, error) {
	var got string
	var err error
	if companyFilter != nil && *companyFilter != "" {
		err = d.pool.QueryRow(ctx, `select id::text from public.tickets where id = $1::uuid and company_id = $2::uuid limit 1`, id, *companyFilter).Scan(&got)
	} else {
		err = d.pool.QueryRow(ctx, `select id::text from public.tickets where id = $1::uuid limit 1`, id).Scan(&got)
	}
	return got, err
}

// CheckRateLimit incrementa o contador persistente (janela fixa) pra
// bucket_key e retorna se essa chamada ainda está dentro do limite.
// Complementa o limitador em memória (lib/ratelimit.go): esse aqui é
// compartilhado entre todas as instâncias serverless, o outro protege só a
// instância local sem round-trip ao banco.
func (d *DB) CheckRateLimit(ctx context.Context, key string, windowSeconds, limit int) (allowed bool, err error) {
	var count int
	err = d.pool.QueryRow(ctx, `select public.check_rate_limit($1, $2, $3)`, key, windowSeconds, limit).Scan(&count)
	if err != nil {
		return false, err
	}
	return count <= limit, nil
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

// SyncCompanyDomainIfEmpty updates a company's domain from the agent's reported domain if currently empty.
//
// "WORKGROUP" é o que o Windows reporta quando a máquina NÃO está num domínio,
// então não é domínio nenhum e nunca deve ser gravado aqui. Antes desta
// correção ele passava: o UPDATE gravava domain='WORKGROUP', e como o próprio
// WHERE trata 'WORKGROUP' como "vazio", o heartbeat seguinte reescrevia o
// mesmo valor de novo, pra sempre. Cada uma dessas escritas no-op ainda
// disparava o trigger de auditoria — 1592 linhas de audit_log em 24h com só
// 2 máquinas ativas, ~800/dia por máquina, todas registrando apenas a
// mudança de updated_at. Com as ~500 máquinas previstas seriam ~440 MB/dia
// de auditoria inútil, sozinhos suficientes pra estourar o limite do plano
// free em um dia.
//
// O IS DISTINCT FROM fecha o caso geral: qualquer heartbeat que traga o
// domínio que já está gravado não vira escrita.
func (d *DB) SyncCompanyDomainIfEmpty(ctx context.Context, companyID, domain string) error {
	clean := strings.TrimSpace(domain)
	if clean == "" || clean == "." || strings.EqualFold(clean, "WORKGROUP") || companyID == "" {
		return nil
	}
	_, err := d.pool.Exec(ctx, `
		UPDATE public.companies
		SET domain = $1, updated_at = now()
		WHERE id = $2
		  AND (domain IS NULL OR domain = '' OR domain = 'WORKGROUP')
		  AND domain IS DISTINCT FROM $1`, clean, companyID)
	return err
}

// MachineByToken retrieves machine details by its unique token.
func (d *DB) MachineByToken(ctx context.Context, token string) (*MachineRow, string, error) {
	var m MachineRow
	var companyID string
	err := d.pool.QueryRow(ctx, `
		SELECT id::text, group_id::text, hostname, ip_address, os, os_version, status, last_seen, agent_version, created_at, company_id::text, "current_user", approval_status
		FROM public.machines WHERE machine_token = $1 LIMIT 1`, token).Scan(
		&m.ID, &m.GroupID, &m.Hostname, &m.IPAddress, &m.OS, &m.OSVersion, &m.Status, &m.LastSeen, &m.AgentVersion, &m.CreatedAt, &companyID, &m.CurrentUser, &m.ApprovalStatus,
	)
	if err != nil {
		return nil, "", err
	}
	return &m, companyID, nil
}

// ErrNoRows is a sentinel for pgx.ErrNoRows so callers don't need to import pgx.
var ErrNoRows = pgx.ErrNoRows
