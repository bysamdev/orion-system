package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// uuidRegex used to check if a string is a standard UUID.
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ticketResolveHandler resolves a numeric ticket ID or a UUID and returns the internal UUID.
func ticketResolveHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	u, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	escopo, err := escopoDoUsuario(ctx, u.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}

	if db == nil {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "sem conexão com banco"})
		return
	}

	idParam := chi.URLParam(r, "id")
	if idParam == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "ID não fornecido"})
		return
	}

	// If it's already a UUID, just return it back to confirm
	if uuidRegex.MatchString(idParam) {
		lib.WriteJSON(w, http.StatusOK, map[string]any{"uuid": idParam})
		return
	}

	// Try parsing as integer
	ticketNumber, err := strconv.Atoi(idParam)
	if err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Formato de ID inválido"})
		return
	}

	uuid, err := db.TicketUUIDByNumberScoped(ctx, ticketNumber, escopo.FiltroEmpresa())
	if err != nil {
		if errors.Is(err, lib.ErrNoRows) {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Chamado não encontrado"})
			return
		}
		log.Printf("[ERRO] falha ao resolver ID numérico de chamado (%d): %v", ticketNumber, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno ao consultar chamado"})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"uuid": uuid})
}
