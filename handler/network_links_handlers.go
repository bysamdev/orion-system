package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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

	companyID := r.URL.Query().Get("company_id")
	if companyID == "" {
		if userCompanyID, err := db.CompanyByUserID(ctx, user.ID); err == nil && userCompanyID != nil {
			companyID = *userCompanyID
		}
	}

	links, err := db.ListNetworkLinks(ctx, companyID)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao buscar links de rede: " + err.Error()})
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

	if req.CompanyID == nil || *req.CompanyID == "" {
		if userCompanyID, err := db.CompanyByUserID(ctx, user.ID); err == nil && userCompanyID != nil {
			req.CompanyID = userCompanyID
		}
	}

	created, err := db.CreateNetworkLink(ctx, req)
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao criar link de rede: " + err.Error()})
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

	id := chi.URLParam(r, "id")
	if id == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID é obrigatório"})
		return
	}

	var companyID string
	if userCompanyID, err := db.CompanyByUserID(ctx, user.ID); err == nil && userCompanyID != nil {
		companyID = *userCompanyID
	}

	if err := db.DeleteNetworkLink(ctx, id, companyID); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao excluir link de rede: " + err.Error()})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GET /api/monitoring/cron/probe-network-links
func cronProbeNetworkLinks(w http.ResponseWriter, r *http.Request) {
	cronSecret := os.Getenv("CRON_SECRET")
	if cronSecret != "" {
		got := r.Header.Get("Authorization")
		if got != "Bearer "+cronSecret {
			lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
			return
		}
	}

	if db == nil {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "sem conexão com banco"})
		return
	}

	summary, err := db.ProbeAllNetworkLinks(r.Context())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	fmt.Printf("[CronProbeNetworkLinks] Summary: %+v\n", summary)
	lib.WriteJSON(w, http.StatusOK, summary)
}
