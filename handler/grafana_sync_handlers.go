package handler

// grafana_sync_handlers.go — replica a divisão por empresa (grupos/clientes)
// que o Orion System já tem também no Grafana: uma pasta + um dashboard por
// empresa, criados/atualizados automaticamente quando uma empresa é
// criada/renomeada/apagada em CompanyManagement.tsx (ver
// lib/grafana_provision.go pro cliente da API do Grafana).

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// monitoringGrafanaSync cria/atualiza a pasta e o dashboard da empresa no
// Grafana. Chamado pelo frontend logo depois de criar ou renomear uma
// empresa — falha aqui não desfaz a empresa já criada no Supabase (o
// Grafana é só um espelho de navegação, não a fonte de verdade), então o
// erro vira um aviso não bloqueante no frontend.
func monitoringGrafanaSync(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	companyID := chi.URLParam(r, "id")
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.PodeVerEmpresa(&companyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: empresa não é a sua"})
		return
	}

	if cfg.GrafanaProvisionToken == "" {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "GRAFANA_PROVISION_TOKEN não configurado"})
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "campo 'name' é obrigatório"})
		return
	}

	provisioner := lib.NewGrafanaProvisioner(cfg.GrafanaURL, cfg.GrafanaProvisionToken)
	if err := provisioner.EnsureCompanyDashboard(ctx, companyID, body.Name); err != nil {
		log.Printf("[ERRO] sincronizar empresa %s com o Grafana: %v", companyID, err)
		lib.WriteJSON(w, http.StatusBadGateway, map[string]any{"error": "Falha ao sincronizar com o Grafana: " + err.Error()})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}

// monitoringGrafanaSyncDelete apaga a pasta (e o dashboard dentro dela) do
// Grafana depois que uma empresa é removida no Orion System. Não depende de
// ler a empresa do banco (ela já foi apagada) — o UID da pasta é
// determinístico a partir do company_id (ver folderUID em
// lib/grafana_provision.go).
func monitoringGrafanaSyncDelete(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	if cfg.GrafanaProvisionToken == "" {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "GRAFANA_PROVISION_TOKEN não configurado"})
		return
	}

	companyID := chi.URLParam(r, "id")
	provisioner := lib.NewGrafanaProvisioner(cfg.GrafanaURL, cfg.GrafanaProvisionToken)
	if err := provisioner.DeleteCompanyDashboard(ctx, companyID); err != nil {
		log.Printf("[ERRO] apagar pasta da empresa %s no Grafana: %v", companyID, err)
		lib.WriteJSON(w, http.StatusBadGateway, map[string]any{"error": "Falha ao remover do Grafana: " + err.Error()})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}
