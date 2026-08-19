package lib

import (
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

//go:embed assets/grafana/cliente-dashboard.json
var dashboardClienteTemplate []byte

// GrafanaProvisioner replica a divisão por empresa que o Orion System já tem
// (grupos/clientes) também no Grafana: uma pasta + um dashboard por empresa,
// filtrados por company_id. É só pra navegação mais rápida do admin — o
// Grafana continua single-org, single-login (ninguém além da equipe interna
// loga nele hoje); não é um portal separado por cliente.
type GrafanaProvisioner struct {
	baseURL  string
	apiToken string
	http     *http.Client
}

func NewGrafanaProvisioner(baseURL, apiToken string) *GrafanaProvisioner {
	return &GrafanaProvisioner{
		baseURL:  strings.TrimRight(baseURL, "/"),
		apiToken: apiToken,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

// folderUID/dashboardUID são determinísticos a partir do company_id — dado
// um company_id, o UID correspondente no Grafana já é conhecido sem
// consultar nada nem guardar uma tabela de correspondência à parte (o que
// também deixa DeleteCompanyDashboard simples: recalcula e apaga).
//
// Prefixos "f-"/"d-" diferentes (em vez de reusar o company_id cru como UID
// dos dois) evitam qualquer risco de colisão caso pastas e dashboards
// dividam o mesmo espaço de UIDs internamente no Grafana — não é um detalhe
// garantido pela API pública, então joga-se seguro. sha256 (não o UUID cru)
// porque o limite de UID do Grafana é 40 caracteres e "f-"+UUID (38) deixa
// margem quase zero pra qualquer ajuste futuro.
func folderUID(companyID string) string    { return "f-" + hashCurto(companyID) }
func dashboardUID(companyID string) string { return "d-" + hashCurto(companyID) }

func hashCurto(s string) string {
	soma := sha256.Sum256([]byte(s))
	return hex.EncodeToString(soma[:])[:16]
}

func (g *GrafanaProvisioner) request(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, g.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiToken)
	req.Header.Set("Content-Type", "application/json")
	return g.http.Do(req)
}

// EnsureCompanyDashboard cria (ou sincroniza, se já existir) a pasta e o
// dashboard do cliente no Grafana. Chamado depois de criar/renomear uma
// empresa no Orion System — idempotente, pode ser chamado de novo a
// qualquer momento pra ressincronizar sem efeito colateral duplicado.
func (g *GrafanaProvisioner) EnsureCompanyDashboard(ctx context.Context, companyID, companyName string) error {
	fUID := folderUID(companyID)
	if err := g.ensureFolder(ctx, fUID, "Cliente: "+companyName); err != nil {
		return fmt.Errorf("pasta do cliente no Grafana: %w", err)
	}
	if err := g.publishDashboard(ctx, fUID, companyID, companyName); err != nil {
		return fmt.Errorf("dashboard do cliente no Grafana: %w", err)
	}
	return nil
}

// ensureFolder cria a pasta se não existir; se já existir (409 — empresa já
// tinha sido sincronizada antes), garante que o título está em dia (a
// empresa pode ter sido renomeada desde a última sincronização).
func (g *GrafanaProvisioner) ensureFolder(ctx context.Context, uid, title string) error {
	res, err := g.request(ctx, http.MethodPost, "/api/folders", map[string]string{"uid": uid, "title": title})
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusOK || res.StatusCode == http.StatusCreated {
		return nil
	}
	if res.StatusCode != http.StatusConflict {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("criar pasta: %s: %s", res.Status, string(b))
	}

	getRes, err := g.request(ctx, http.MethodGet, "/api/folders/"+uid, nil)
	if err != nil {
		return err
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(getRes.Body)
		return fmt.Errorf("consultar pasta existente: %s: %s", getRes.Status, string(b))
	}
	var existente struct {
		Version int `json:"version"`
	}
	if err := json.NewDecoder(getRes.Body).Decode(&existente); err != nil {
		return fmt.Errorf("decodificar pasta existente: %w", err)
	}

	putRes, err := g.request(ctx, http.MethodPut, "/api/folders/"+uid, map[string]any{
		"title": title, "version": existente.Version, "overwrite": true,
	})
	if err != nil {
		return err
	}
	defer putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(putRes.Body)
		return fmt.Errorf("renomear pasta: %s: %s", putRes.Status, string(b))
	}
	return nil
}

// publishDashboard substitui os placeholders do template embutido
// (__COMPANY_ID__/__COMPANY_NAME__) e sobe (cria ou sobrescreve via
// overwrite:true) o dashboard na pasta da empresa.
func (g *GrafanaProvisioner) publishDashboard(ctx context.Context, fUID, companyID, companyName string) error {
	raw := string(dashboardClienteTemplate)
	raw = strings.ReplaceAll(raw, "__COMPANY_ID__", companyID)
	raw = strings.ReplaceAll(raw, "__COMPANY_NAME__", companyName)

	var dashboard map[string]any
	if err := json.Unmarshal([]byte(raw), &dashboard); err != nil {
		return fmt.Errorf("template de dashboard inválido: %w", err)
	}
	dashboard["uid"] = dashboardUID(companyID)

	res, err := g.request(ctx, http.MethodPost, "/api/dashboards/db", map[string]any{
		"dashboard": dashboard,
		"folderUid": fUID,
		"overwrite": true,
		"message":   "sincronizado automaticamente pelo Orion System",
	})
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("publicar dashboard: %s: %s", res.Status, string(b))
	}
	return nil
}

// DeleteCompanyDashboard remove a pasta (e o dashboard dentro dela, que o
// Grafana apaga em cascata) depois que uma empresa é excluída no Orion
// System. 404 (pasta já não existe) não é erro: o objetivo final — a pasta
// não existir mais — já está alcançado.
func (g *GrafanaProvisioner) DeleteCompanyDashboard(ctx context.Context, companyID string) error {
	res, err := g.request(ctx, http.MethodDelete, "/api/folders/"+folderUID(companyID), nil)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK || res.StatusCode == http.StatusNotFound {
		return nil
	}
	b, _ := io.ReadAll(res.Body)
	return fmt.Errorf("apagar pasta: %s: %s", res.Status, string(b))
}
