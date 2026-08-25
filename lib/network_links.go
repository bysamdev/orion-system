package lib

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// isBlockedIP recusa endereços privados/reservados (RFC 1918, loopback,
// link-local -- inclui 169.254.169.254, metadados de nuvem) como alvo de
// probe. Usado tanto na validação de DNS resolvido quanto no Control do
// dialer, pra fechar a janela de DNS rebinding entre resolver e conectar.
func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsUnspecified() || ip.IsPrivate() || ip.IsMulticast()
}

// safeDialControl roda depois da resolução de DNS e antes do connect() de
// verdade -- valida o IP que efetivamente vai receber a conexão, não o
// hostname original, fechando a janela de DNS rebinding.
func safeDialControl(network, address string, c syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		host = address
	}
	if ip := net.ParseIP(host); ip != nil && isBlockedIP(ip) {
		return fmt.Errorf("conexão bloqueada: endereço privado/reservado %s", ip)
	}
	return nil
}

// hostHasBlockedIP resolve host (se já não for um IP) e recusa se qualquer
// endereço resolvido for privado/reservado. Usado antes de chamar o comando
// OS ping, que não passa pelo Control do net.Dialer.
func hostHasBlockedIP(host string) bool {
	if ip := net.ParseIP(host); ip != nil {
		return isBlockedIP(ip)
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return true // falha ao resolver: bloqueia por padrão
	}
	for _, ip := range ips {
		if isBlockedIP(ip) {
			return true
		}
	}
	return false
}

func newSafeDialer(timeout time.Duration) *net.Dialer {
	return &net.Dialer{Timeout: timeout, Control: safeDialControl}
}

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

// ProbeSummary returns status counters after probing all links.
type ProbeSummary struct {
	Total   int `json:"total"`
	Online  int `json:"online"`
	Offline int `json:"offline"`
}

// ListNetworkLinks retrieves network links for a company (or all if companyID is empty/all).
func (d *DB) ListNetworkLinks(ctx context.Context, companyID string) ([]NetworkLinkRow, error) {
	query := `
SELECT 
    nl.id::text, 
    nl.company_id::text, 
    c.name as company_name, 
    nl.name, 
    COALESCE(NULLIF(nl.link_type, ''), nl.type, 'starlink') as link_type,
    COALESCE(NULLIF(nl.type, ''), nl.link_type, 'starlink') as type,
    COALESCE(NULLIF(nl.ip_or_hostname, ''), nl.ip_or_host, '') as ip_or_hostname,
    COALESCE(NULLIF(nl.ip_or_host, ''), nl.ip_or_hostname, '') as ip_or_host,
    COALESCE(nl.check_interval_seconds, 300) as check_interval_seconds,
    COALESCE(nl.status, 'pending') as status,
    COALESCE(nl.last_ping_ms, nl.latency_ms) as last_ping_ms,
    COALESCE(nl.latency_ms, nl.last_ping_ms) as latency_ms,
    COALESCE(nl.last_checked_at, nl.last_check) as last_checked_at,
    COALESCE(nl.last_check, nl.last_checked_at) as last_check,
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
			&r.LinkType, &r.Type, &r.IPOrHostname, &r.IPOrHost,
			&r.CheckIntervalSeconds, &r.Status,
			&r.LastPingMS, &r.LatencyMS, &r.LastCheckedAt, &r.LastCheck,
			&r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, err
		}
		r.LatencyMS = r.LastPingMS
		r.LastCheck = r.LastCheckedAt
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

	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = "pending"
	}

	var compID *string
	if in.CompanyID != nil && *in.CompanyID != "" {
		compID = in.CompanyID
	}

	var row NetworkLinkRow
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.network_links 
    (company_id, name, link_type, type, ip_or_hostname, ip_or_host, check_interval_seconds, status, created_at, updated_at)
VALUES 
    ($1, $2, $3, $3, $4, $4, $5, $6, now(), now())
RETURNING 
    id::text, company_id::text, name, 
    COALESCE(link_type, type) as link_type, 
    COALESCE(type, link_type) as type, 
    COALESCE(ip_or_hostname, ip_or_host) as ip_or_hostname, 
    COALESCE(ip_or_host, ip_or_hostname) as ip_or_host, 
    COALESCE(check_interval_seconds, 300), 
    status, last_ping_ms, latency_ms, last_checked_at, last_check, created_at, updated_at
`, compID, name, linkType, host, checkInterval, status).Scan(
		&row.ID, &row.CompanyID, &row.Name, &row.LinkType, &row.Type,
		&row.IPOrHostname, &row.IPOrHost, &row.CheckIntervalSeconds, &row.Status,
		&row.LastPingMS, &row.LatencyMS, &row.LastCheckedAt, &row.LastCheck,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
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

// UpdateNetworkLinkStatus updates probed status, ping latency, and last_checked_at timestamp.
func (d *DB) UpdateNetworkLinkStatus(ctx context.Context, id string, status string, pingMs int) error {
	var pingVal *int
	if status == "online" && pingMs >= 0 {
		pingVal = &pingMs
	}
	_, err := d.pool.Exec(ctx, `
UPDATE public.network_links
SET status = $2,
    last_ping_ms = $3,
    latency_ms = $3,
    last_checked_at = now(),
    last_check = now(),
    updated_at = now()
WHERE id = $1
`, id, status, pingVal)
	return err
}

// ProbeNetworkTarget probes a network link target (IP, hostname, or URL).
func ProbeNetworkTarget(target string) (status string, pingMs int, err error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return "offline", 0, fmt.Errorf("target vazio")
	}

	start := time.Now()

	// 1. If target starts with http:// or https://, run HTTP probe
	if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
		client := &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				DialContext: newSafeDialer(5 * time.Second).DialContext,
			},
		}
		resp, err := client.Get(target)
		if err == nil {
			resp.Body.Close()
			return "online", int(time.Since(start).Milliseconds()), nil
		}
		return "offline", 0, err
	}

	// 2. Extract host if target contains port or path
	host := target
	port := ""
	if strings.Contains(target, ":") {
		h, p, err := net.SplitHostPort(target)
		if err == nil {
			host = h
			port = p
		}
	}

	// If explicit port was supplied, try TCP connection first
	if port != "" {
		conn, err := newSafeDialer(4 * time.Second).Dial("tcp", target)
		if err == nil {
			conn.Close()
			return "online", int(time.Since(start).Milliseconds()), nil
		}
	}

	// 3. Try OS ping command (reliable without raw socket privileges).
	// exec.Command não passa pelo Control do net.Dialer -- valida o host
	// resolvido antes de disparar o ping.
	if hostHasBlockedIP(host) {
		return "offline", 0, fmt.Errorf("destino bloqueado: endereço privado/reservado")
	}
	pingStatus, pingTime, pingErr := osPing(host)
	if pingErr == nil && pingStatus == "online" {
		return "online", pingTime, nil
	}

	// 4. Fallback: try TCP dial on port 80, 443, 53
	tcpPorts := []string{"80", "443", "53"}
	if port != "" {
		tcpPorts = append([]string{port}, tcpPorts...)
	}
	for _, p := range tcpPorts {
		conn, err := newSafeDialer(2 * time.Second).Dial("tcp", net.JoinHostPort(host, p))
		if err == nil {
			conn.Close()
			return "online", int(time.Since(start).Milliseconds()), nil
		}
	}

	return "offline", 0, fmt.Errorf("target inacessível")
}

var pingRegex = regexp.MustCompile(`(?:time|tempo)[=<]\s*(\d+)ms`)
var pingAvgRegex = regexp.MustCompile(`(?:Average|media|Média)\s*=\s*(\d+)ms`)

func osPing(host string) (status string, pingMs int, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "ping", "-n", "1", "-w", "3000", host)
	} else {
		cmd = exec.CommandContext(ctx, "ping", "-c", "1", "-W", "3", host)
	}

	start := time.Now()
	out, err := cmd.Output()
	duration := int(time.Since(start).Milliseconds())

	if err != nil {
		return "offline", 0, err
	}

	outStr := string(out)
	if matches := pingAvgRegex.FindStringSubmatch(outStr); len(matches) > 1 {
		if val, parseErr := strconv.Atoi(matches[1]); parseErr == nil {
			return "online", val, nil
		}
	}
	if matches := pingRegex.FindStringSubmatch(outStr); len(matches) > 1 {
		if val, parseErr := strconv.Atoi(matches[1]); parseErr == nil {
			return "online", val, nil
		}
	}

	return "online", duration, nil
}

// ProbeAllNetworkLinks probes all stored network link targets and updates DB.
func (d *DB) ProbeAllNetworkLinks(ctx context.Context) (ProbeSummary, error) {
	links, err := d.ListNetworkLinks(ctx, "")
	if err != nil {
		return ProbeSummary{}, err
	}

	var summary ProbeSummary
	summary.Total = len(links)
	if summary.Total == 0 {
		return summary, nil
	}

	type result struct {
		id     string
		status string
		pingMs int
	}

	sem := make(chan struct{}, 10)
	resChan := make(chan result, len(links))
	var wg sync.WaitGroup

	for _, link := range links {
		wg.Add(1)
		go func(l NetworkLinkRow) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			target := l.IPOrHostname
			if target == "" {
				target = l.IPOrHost
			}

			status, pingMs, _ := ProbeNetworkTarget(target)
			resChan <- result{id: l.ID, status: status, pingMs: pingMs}
		}(link)
	}

	wg.Wait()
	close(resChan)

	var updateWg sync.WaitGroup
	var mu sync.Mutex

	for res := range resChan {
		mu.Lock()
		if res.status == "online" {
			summary.Online++
		} else {
			summary.Offline++
		}
		mu.Unlock()

		updateWg.Add(1)
		go func(r result) {
			defer updateWg.Done()
			_ = d.UpdateNetworkLinkStatus(ctx, r.id, r.status, r.pingMs)
		}(res)
	}

	updateWg.Wait()

	fmt.Printf("[NetworkLinksWorker] Probed %d links: %d online, %d offline\n", summary.Total, summary.Online, summary.Offline)
	return summary, nil
}
