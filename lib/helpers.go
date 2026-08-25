package lib

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"math/big"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"
)

// MaxJSONBodySize é o tamanho máximo permitido para o payload JSON (4 MB).
// Protege o backend contra exaustão de memória em picos de concorrência ou DoS.
const MaxJSONBodySize = 4 << 20

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type contextKey string

const (
	UserContextKey  contextKey = "authUser"
	ScopeContextKey contextKey = "userScope"
)

// ContextWithUserAndScope returns a new context with the given user and scope.
func ContextWithUserAndScope(ctx context.Context, user *AuthUser, scope UserScope) context.Context {
	ctx = context.WithValue(ctx, UserContextKey, user)
	ctx = context.WithValue(ctx, ScopeContextKey, scope)
	return ctx
}

// UserFromContext retrieves the user from the context.
func UserFromContext(ctx context.Context) (*AuthUser, bool) {
	user, ok := ctx.Value(UserContextKey).(*AuthUser)
	return user, ok
}

// ScopeFromContext retrieves the scope from the context.
func ScopeFromContext(ctx context.Context) (UserScope, bool) {
	scope, ok := ctx.Value(ScopeContextKey).(UserScope)
	return scope, ok
}

// DecodeBody decodes JSON from r.Body into out, disallowing unknown fields, com limite de 4MB.
func DecodeBody(r *http.Request, out any) error {
	limitedReader := io.LimitReader(r.Body, MaxJSONBodySize)
	dec := json.NewDecoder(limitedReader)
	dec.DisallowUnknownFields()
	return dec.Decode(out)
}

// DecodeLenient decodes JSON from r.Body into out, allowing unknown fields, com limite de 4MB.
func DecodeLenient(r *http.Request, out any) error {
	limitedReader := io.LimitReader(r.Body, MaxJSONBodySize)
	return json.NewDecoder(limitedReader).Decode(out)
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

// RequireAuth validates the Bearer token from Authorization header and returns
// the authenticated user info. Uses the provided SupabaseClient.
func RequireAuth(r *http.Request, sb *SupabaseClient) (*AuthUser, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, errors.New("não autorizado: token ausente")
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, errors.New("não autorizado: header Authorization inválido")
	}
	u, err := sb.GetUserByAccessToken(r.Context(), parts[1])
	if err != nil {
		return nil, errors.New("não autorizado: token inválido ou expirado")
	}
	return u, nil
}

// ValidateAgentKey validates the X-Agent-Key header against the configured key
// OR against the api_keys table in the database.
func ValidateAgentKey(r *http.Request, globalKey string, db *DB) (string, error) {
	got := r.Header.Get("X-Agent-Key")
	if got == "" {
		got = r.Header.Get("x-agent-key")
	}
	if got == "" {
		return "", errors.New("chave de agente ausente")
	}

	// 1. Check global/static key (backward compatibility / admin)
	if globalKey != "" && got == globalKey {
		return "global", nil
	}

	// 2. Check dynamic keys in DB
	if db != nil {
		companyID, err := db.ValidateAPIKey(r.Context(), got)
		if err == nil {
			return companyID, nil
		}
	}

	return "", errors.New("chave de agente inválida")
}

// NilIfEmpty returns nil if s is an empty string, otherwise returns the string.
// Useful for optional UUID columns in database queries.
func NilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ClientIP devolve a chave de identificação usada pelos rate limiters.
//
// Prefere o IP resolvido por middleware.ClientIPFromXFFTrustedProxies, que só
// considera a entrada de X-Forwarded-For acrescentada pelo nosso próprio proxy
// — a única que o cliente não consegue forjar. O middleware.RealIP anterior
// confiava no header cru, então bastava variá-lo para burlar os limites.
//
// Sem esse valor (dev local sem proxy, ou XFF menor que o esperado), cai para
// r.RemoteAddr. O fallback é seguro: fora da Vercel não há proxy no caminho,
// e r.RemoteAddr passa a ser o IP real da conexão TCP.
func ClientIP(r *http.Request) string {
	if ip := middleware.GetClientIP(r.Context()); ip != "" {
		return ip
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// GenerateRandomPassword creates a secure random string of given length.
func GenerateRandomPassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	ret := make([]byte, length)
	for i := 0; i < length; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		ret[i] = charset[num.Int64()]
	}
	return string(ret)
}
