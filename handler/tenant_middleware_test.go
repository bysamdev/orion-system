package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion-api/lib"
)

// mockarEscopo troca os pontos de injeção de RequireCompanyScope e devolve a
// função de restauração.
func mockarEscopo(t *testing.T, user *lib.AuthUser, authErr error, scope lib.UserScope, scopeErr error) {
	t.Helper()

	oldAuth, oldScope := autenticar, resolverEscopo
	autenticar = func(*http.Request) (*lib.AuthUser, error) { return user, authErr }
	resolverEscopo = func(*http.Request, string) (lib.UserScope, error) { return scope, scopeErr }

	t.Cleanup(func() { autenticar, resolverEscopo = oldAuth, oldScope })
}

func TestRequireCompanyScope(t *testing.T) {
	// Handler protegido: só responde 200 se usuário E escopo chegaram no
	// contexto. É o que prova que o middleware injetou os dois.
	protegido := RequireCompanyScope(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, temUser := lib.UserFromContext(r.Context())
		_, temEscopo := lib.ScopeFromContext(r.Context())
		if !temUser || !temEscopo {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	empresaA := "company-aaa"

	casos := []struct {
		nome     string
		user     *lib.AuthUser
		authErr  error
		scope    lib.UserScope
		scopeErr error
		esperado int
	}{
		{
			nome:     "sem Authorization → 401",
			authErr:  errors.New("token ausente"),
			esperado: http.StatusUnauthorized,
		},
		{
			nome:     "escopo irresolvível → 500 (fail-closed, não passa adiante)",
			user:     &lib.AuthUser{ID: "user-123"},
			scopeErr: errors.New("banco fora"),
			esperado: http.StatusInternalServerError,
		},
		{
			nome:     "usuário sem empresa e sem visão global → 403",
			user:     &lib.AuthUser{ID: "user-123"},
			scope:    lib.UserScope{CompanyID: nil, Role: "customer"},
			esperado: http.StatusForbidden,
		},
		{
			nome:     "usuário comum com empresa → 200 e contexto injetado",
			user:     &lib.AuthUser{ID: "user-123"},
			scope:    lib.UserScope{CompanyID: &empresaA, Role: "technician"},
			esperado: http.StatusOK,
		},
		{
			nome:     "developer sem empresa → 200 (visão global)",
			user:     &lib.AuthUser{ID: "dev-456"},
			scope:    lib.UserScope{CompanyID: nil, Role: "developer"},
			esperado: http.StatusOK,
		},
		{
			nome:     "usuário da empresa master → 200 (visão global)",
			user:     &lib.AuthUser{ID: "master-789"},
			scope:    lib.UserScope{CompanyID: nil, Role: "admin", Master: true},
			esperado: http.StatusOK,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			mockarEscopo(t, c.user, c.authErr, c.scope, c.scopeErr)

			rec := httptest.NewRecorder()
			protegido.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

			if rec.Code != c.esperado {
				t.Errorf("esperado status %d, recebido %d", c.esperado, rec.Code)
			}
		})
	}
}

// TestRotasDeUsuarioExigemEscopo é a rede de proteção contra o modo de falha
// que motivou o middleware: uma rota nova de usuário registrada fora do grupo
// escopado, voltando ao modelo "cada handler que se lembre de filtrar".
//
// Não cobre as rotas com autenticação própria (agente, cron, machine-login,
// WebSocket) — essas não recebem JWT de usuário e estão listadas no buildRouter
// com a barreira de cada uma.
func TestRotasDeUsuarioExigemEscopo(t *testing.T) {
	// autenticar falha: qualquer rota atrás de RequireCompanyScope tem de
	// responder 401 ANTES de tocar no handler (que precisaria de db/sb reais).
	mockarEscopo(t, nil, errors.New("token ausente"), lib.UserScope{}, nil)

	rotas := []struct {
		metodo string
		caminho string
	}{
		{http.MethodGet, "/api/monitoring/dashboard"},
		{http.MethodGet, "/api/monitoring/groups"},
		{http.MethodGet, "/api/monitoring/groups/abc/machines"},
		{http.MethodGet, "/api/monitoring/machines/abc"},
		{http.MethodGet, "/api/monitoring/machines/abc/metrics"},
		{http.MethodGet, "/api/monitoring/machines/abc/alerts"},
		{http.MethodPost, "/api/monitoring/machines/abc/commands"},
		{http.MethodGet, "/api/monitoring/machines/abc/commands"},
		{http.MethodGet, "/api/monitoring/alerts/critical"},
		{http.MethodPost, "/api/monitoring/machines/abc/update"},
		{http.MethodPost, "/api/monitoring/groups"},
		{http.MethodPost, "/api/monitoring/groups/abc/update"},
		{http.MethodDelete, "/api/monitoring/groups/abc"},
		{http.MethodGet, "/api/monitoring/network-links"},
		{http.MethodPost, "/api/monitoring/network-links"},
		{http.MethodDelete, "/api/monitoring/network-links/abc"},
		{http.MethodGet, "/api/monitoring/network/links"},
		{http.MethodPost, "/api/monitoring/network/links"},
		{http.MethodDelete, "/api/monitoring/network/links/abc"},
		{http.MethodGet, "/api/monitoring/web/endpoints"},
		{http.MethodPost, "/api/monitoring/web/endpoints"},
		{http.MethodDelete, "/api/monitoring/web/endpoints/abc"},
		{http.MethodGet, "/api/tickets/resolve/1"},
		{http.MethodPost, "/api/functions/admin-update-user"},
		{http.MethodPost, "/api/functions/delete-user-admin"},
		{http.MethodPost, "/api/functions/create-user-credentials"},
		{http.MethodPost, "/api/functions/check-rate-limit"},
		{http.MethodPost, "/api/functions/send-password-changed-alert"},
	}

	roteador := buildRouter()

	for _, rota := range rotas {
		t.Run(rota.metodo+" "+rota.caminho, func(t *testing.T) {
			rec := httptest.NewRecorder()
			roteador.ServeHTTP(rec, httptest.NewRequest(rota.metodo, rota.caminho, nil))

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("rota sem escopo obrigatório: esperado 401, recebido %d — "+
					"registre-a dentro do r.Group(RequireCompanyScope) em buildRouter", rec.Code)
			}
		})
	}
}

// TestRotasComAutenticacaoPropriaNaoExigemEscopo garante o contrário: as rotas
// de agente/cron NÃO podem entrar no grupo escopado, senão o agente Windows e
// os crons da Vercel passam a receber 401 e o monitoramento para de funcionar.
//
// Cada caso afirma a resposta da barreira PRÓPRIA da rota. Se alguém mover uma
// delas para dentro do r.Group, o RequireCompanyScope responde 401 e o teste
// quebra — que é exatamente o alarme desejado.
func TestRotasComAutenticacaoPropriaNaoExigemEscopo(t *testing.T) {
	// autenticar falharia se o middleware de escopo rodasse nestas rotas.
	mockarEscopo(t, nil, errors.New("token ausente"), lib.UserScope{}, nil)

	// Sem CRON_SECRET no ambiente, autorizarCron responde 503 (fail-closed).
	t.Setenv("CRON_SECRET", "")

	casos := []struct {
		metodo   string
		caminho  string
		esperado int
		porque   string
	}{
		{http.MethodGet, "/api/monitoring/cron/mark-offline", http.StatusServiceUnavailable, "autorizarCron sem CRON_SECRET"},
		{http.MethodGet, "/api/monitoring/cron/probe-network-links", http.StatusServiceUnavailable, "autorizarCron sem CRON_SECRET"},
		{http.MethodGet, "/api/auth/machine-login", http.StatusBadRequest, "token da máquina ausente"},
		{http.MethodPost, "/api/functions/reset-password-with-token", http.StatusBadRequest, "corpo vazio"},
	}

	roteador := buildRouter()

	for _, c := range casos {
		t.Run(c.metodo+" "+c.caminho, func(t *testing.T) {
			rec := httptest.NewRecorder()
			roteador.ServeHTTP(rec, httptest.NewRequest(c.metodo, c.caminho, nil))

			if rec.Code == http.StatusUnauthorized {
				t.Fatalf("rota com autenticação própria caiu no RequireCompanyScope (401) — "+
					"ela deve ficar FORA do r.Group em buildRouter; esperado %d (%s)", c.esperado, c.porque)
			}
			if rec.Code != c.esperado {
				t.Errorf("esperado %d (%s), recebido %d", c.esperado, c.porque, rec.Code)
			}
		})
	}
}
