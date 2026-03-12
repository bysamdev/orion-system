package lib

import (
	"encoding/json"
	"errors"
	"html/template"
	"net/http"
	"strings"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// DecodeBody decodes JSON from r.Body into out, disallowing unknown fields.
func DecodeBody(r *http.Request, out any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(out)
}

// DecodeLenient decodes JSON from r.Body into out, allowing unknown fields.
func DecodeLenient(r *http.Request, out any) error {
	return json.NewDecoder(r.Body).Decode(out)
}

// RenderTemplate renders a Go html/template with the given data.
func RenderTemplate(tpl string, data any) (string, error) {
	t, err := template.New("email").Parse(tpl)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	if err := t.Execute(&b, data); err != nil {
		return "", err
	}
	return b.String(), nil
}

// RequireAuth validates the Bearer token from Authorization header.
func RequireAuth(r *http.Request, sb *SupabaseClient) (*AuthUser, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, errors.New("nao autorizado: token ausente")
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, errors.New("nao autorizado: header Authorization invalido")
	}
	u, err := sb.GetUserByAccessToken(r.Context(), parts[1])
	if err != nil {
		return nil, errors.New("nao autorizado: token invalido ou expirado")
	}
	return u, nil
}

// RequireAgentKey validates the X-Agent-Key header against the configured key.
func RequireAgentKey(r *http.Request, key string) error {
	if key == "" {
		return errors.New("servidor sem AGENT_KEY configurado")
	}
	got := r.Header.Get("X-Agent-Key")
	if got == "" {
		got = r.Header.Get("x-agent-key")
	}
	if got != key {
		return errors.New("chave de agente invalida")
	}
	return nil
}
