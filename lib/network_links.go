package lib

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"
)

// NetworkLinkRow represents a row in public.network_links.
type NetworkLinkRow struct {
	ID                   string     `json:"id"`
	CompanyID            *string    `json:"company_id"`
	CompanyName          *string    `json:"company_name,omitempty"`
	Name                 string     `json:"name"`
	LinkType             string     `json:"link_type"`
	Type                 string     `json:"type"`
	IPOrHostname         string     `json:"ip_or_hostname"`
	IPOrHost             string     `json:"ip_or_host"`
	CheckIntervalSeconds int        `json:"check_interval_seconds"`
	Status               string     `json:"status"` // 'pending', 'online', 'offline'
	LastPingMS           *int       `json:"last_ping_ms"`
	LatencyMS            *int       `json:"latency_ms"`
	LastCheckedAt        *time.Time `json:"last_checked_at"`
	LastCheck            *time.Time `json:"last_check"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// preencherNomesAntigos repete nos campos type, ip_or_host, latency_ms e
// last_check os valores das colunas canônicas. As colunas duplicadas saíram
// do banco (ORN-DUP-05), mas a tela ainda lê esses nomes.
func (r *NetworkLinkRow) preencherNomesAntigos() {
	r.Type = r.LinkType
	r.IPOrHost = r.IPOrHostname
	r.LatencyMS = r.LastPingMS
	r.LastCheck = r.LastCheckedAt
}

// CreateNetworkLinkInput represents payload to insert a new link.
type CreateNetworkLinkInput struct {
	CompanyID            *string `json:"company_id"`
	Name                 string  `json:"name"`
	LinkType             string  `json:"link_type"`
	Type                 string  `json:"type"`
	IPOrHostname         string  `json:"ip_or_hostname"`
	IPOrHost             string  `json:"ip_or_host"`
	CheckIntervalSeconds *int    `json:"check_interval_seconds"`
	Status               string  `json:"status"`
}

// ListNetworkLinks retrieves network links for a company (or all if companyID is empty/all).
func (d *DB) ListNetworkLinks(ctx context.Context, companyID string) ([]NetworkLinkRow, error) {
	query := `
SELECT 
    nl.id::text, 
    nl.company_id::text, 
    c.name as company_name, 
    nl.name, 
    COALESCE(NULLIF(nl.link_type, ''), 'starlink') as link_type,
    COALESCE(nl.ip_or_hostname, '') as ip_or_hostname,
    COALESCE(nl.check_interval_seconds, 300) as check_interval_seconds,
    COALESCE(nl.status, 'pending') as status,
    nl.last_ping_ms,
    nl.last_checked_at,
    nl.created_at,
    COALESCE(nl.updated_at, nl.created_at) as updated_at
FROM public.network_links nl
LEFT JOIN public.companies c ON c.id = nl.company_id
`
	var args []any
	if companyID != "" && companyID != "all" {
		query += ` WHERE nl.company_id = $1`
		args = append(args, companyID)
	}
	query += ` ORDER BY nl.created_at DESC`

	rows, err := d.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []NetworkLinkRow
	for rows.Next() {
		var r NetworkLinkRow
		if err := rows.Scan(
			&r.ID, &r.CompanyID, &r.CompanyName, &r.Name,
			&r.LinkType, &r.IPOrHostname,
			&r.CheckIntervalSeconds, &r.Status,
			&r.LastPingMS, &r.LastCheckedAt,
			&r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, err
		}
		r.preencherNomesAntigos()
		out = append(out, r)
	}
	return out, rows.Err()
}

// CreateNetworkLink inserts a new network link target.
func (d *DB) CreateNetworkLink(ctx context.Context, in CreateNetworkLinkInput) (*NetworkLinkRow, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, fmt.Errorf("nome é obrigatório")
	}

	linkType := strings.TrimSpace(in.LinkType)
	if linkType == "" {
		linkType = strings.TrimSpace(in.Type)
	}
	if linkType == "" {
		linkType = "starlink"
	}

	host := strings.TrimSpace(in.IPOrHostname)
	if host == "" {
		host = strings.TrimSpace(in.IPOrHost)
	}
	if host == "" {
		return nil, fmt.Errorf("ip_or_hostname é obrigatório")
	}

	cleanHost := host
	if idx := strings.Index(cleanHost, "://"); idx != -1 {
		cleanHost = cleanHost[idx+3:]
	}
	if h, _, err := net.SplitHostPort(cleanHost); err == nil {
		cleanHost = h
	}
	validHostRegex := regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,253}[a-zA-Z0-9])?$`)
	if !validHostRegex.MatchString(cleanHost) && net.ParseIP(cleanHost) == nil {
		return nil, fmt.Errorf("ip_or_hostname possui formato inválido")
	}

	checkInterval := 300
	if in.CheckIntervalSeconds != nil && *in.CheckIntervalSeconds > 0 {
		checkInterval = *in.CheckIntervalSeconds
	}

	// O estado inicial não é informado pelo solicitante: só o Blackbox pode
	// confirmar se o alvo responde. Nunca publicar "online" sem uma sonda.
	status := "pending"

	var compID *string
	if in.CompanyID != nil && *in.CompanyID != "" {
		compID = in.CompanyID
	}

	var row NetworkLinkRow
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.network_links
    (company_id, name, link_type, ip_or_hostname, check_interval_seconds, status, created_at, updated_at)
VALUES
    ($1, $2, $3, $4, $5, $6, now(), now())
RETURNING
    id::text, company_id::text, name, link_type, ip_or_hostname,
    COALESCE(check_interval_seconds, 300),
    status, last_ping_ms, last_checked_at, created_at, updated_at
`, compID, name, linkType, host, checkInterval, status).Scan(
		&row.ID, &row.CompanyID, &row.Name, &row.LinkType,
		&row.IPOrHostname, &row.CheckIntervalSeconds, &row.Status,
		&row.LastPingMS, &row.LastCheckedAt,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	row.preencherNomesAntigos()
	return &row, nil
}

// DeleteNetworkLink deletes a network link by ID.
func (d *DB) DeleteNetworkLink(ctx context.Context, id string, companyID string) error {
	var err error
	if companyID != "" && companyID != "all" {
		_, err = d.pool.Exec(ctx, `DELETE FROM public.network_links WHERE id = $1 AND company_id = $2`, id, companyID)
	} else {
		_, err = d.pool.Exec(ctx, `DELETE FROM public.network_links WHERE id = $1`, id)
	}
	return err
}
