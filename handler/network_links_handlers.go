package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// GET /api/monitoring/network/links and GET /api/monitoring/network-links
func monitoringListNetworkLinks(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	// Correção: antes, ?company_id= da query string era usado sem checar
	// contra a empresa do chamador — qualquer usuário autenticado lia os
	// network links de qualquer empresa só trocando o parâmetro. Só quem
	// enxerga tudo (master/developer) pode escolher a empresa livremente;
	// os demais sempre recebem o filtro da própria empresa.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	var companyID string
	if escopo.Global() {
		companyID = r.URL.Query().Get("company_id")
	} else if escopo.CompanyID != nil {
		companyID = *escopo.CompanyID
	} else {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}

	links, err := db.ListNetworkLinks(ctx, companyID)
	if err != nil {
		log.Printf("[erro] ListNetworkLinks company=%s: %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar links de rede"})
		return
	}

	if links == nil {
		links = []lib.NetworkLinkRow{}
	}

	lib.WriteJSON(w, http.StatusOK, links)
}

// POST /api/monitoring/network/links and POST /api/monitoring/network-links
func monitoringCreateNetworkLink(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	var req lib.CreateNetworkLinkInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Requisição inválida: " + err.Error()})
		return
	}

	// Correção: antes, um company_id enviado no corpo era aceito sem checar
	// contra a empresa do chamador — qualquer usuário autenticado podia criar
	// um link "pertencendo" a outra empresa. Só quem enxerga tudo pode
	// escolher a empresa livremente; os demais sempre criam na própria.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem gerenciar links de rede"})
		return
	}
	if escopo.Global() {
		if req.CompanyID == nil || *req.CompanyID == "" {
			if userCompanyID, err := db.CompanyByUserID(ctx, user.ID); err == nil && userCompanyID != nil {
				req.CompanyID = userCompanyID
			}
		}
	} else if escopo.CompanyID != nil {
		req.CompanyID = escopo.CompanyID
	} else {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}

	created, err := db.CreateNetworkLink(ctx, req)
	if err != nil {
		log.Printf("[ERRO] falha ao criar link de rede: %v", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao criar link de rede"})
		return
	}

	// Trigger immediate probe asynchronously so initial status gets populated
	go func(id string, target string) {
		pCtx, pCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer pCancel()
		status, pingMs, _ := lib.ProbeNetworkTarget(target)
		_ = db.UpdateNetworkLinkStatus(pCtx, id, status, pingMs)
	}(created.ID, created.IPOrHostname)

	lib.WriteJSON(w, http.StatusCreated, created)
}

// DELETE /api/monitoring/network/links/{id} and DELETE /api/monitoring/network-links/{id}
func monitoringDeleteNetworkLink(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil || !papeisComandoRemoto[escopo.Role] {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem excluir links de rede"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}

	var companyID string
	if escopo.Global() {
		companyID = "all"
	} else if escopo.CompanyID != nil {
		companyID = *escopo.CompanyID
	} else {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}

	if err := db.DeleteNetworkLink(ctx, id, companyID); err != nil {
		log.Printf("[ERRO] falha ao excluir link de rede %s: %v", id, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao excluir link de rede"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GET /api/monitoring/cron/probe-network-links
func cronProbeNetworkLinks(w http.ResponseWriter, r *http.Request) {
	// Mesmo fail-open que existia em cronMarkOffline; o relatório do pentest só
	// apontou o outro, mas o padrão era idêntico. Ver autorizarCron em router.go.
	if !autorizarCron(w, r) {
		return
	}

	if db == nil {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "sem conexão com banco"})
		return
	}

	summary, err := db.ProbeAllNetworkLinks(r.Context())
	if err != nil {
		log.Printf("[erro] ProbeAllNetworkLinks: %v", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
		return
	}

	fmt.Printf("[CronProbeNetworkLinks] Summary: %+v\n", summary)
	lib.WriteJSON(w, http.StatusOK, summary)
}
