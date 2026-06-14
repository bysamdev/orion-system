package handler

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// uuidRegex used to check if a string is a standard UUID.
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ticketResolveHandler resolves a numeric ticket ID or a UUID and returns the internal UUID.
func ticketResolveHandler(w http.ResponseWriter, r *http.Request) {
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

	uuid, err := db.TicketUUIDByNumber(r.Context(), ticketNumber)
	if err != nil {
		if errors.Is(err, lib.ErrNoRows) {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Chamado não encontrado"})
			return
		}
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"uuid": uuid})
}
