package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnderecoDasMetricas(t *testing.T) {
	casos := []struct {
		nome, token, esperado string
	}{
		{"sem token fica só na máquina", "", "127.0.0.1:9182"},
		{"token em branco conta como sem token", "   ", "127.0.0.1:9182"},
		{"com token abre para a rede", "abc", ":9182"},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := enderecoDasMetricas(c.token, 9182); got != c.esperado {
				t.Errorf("enderecoDasMetricas(%q) = %q, esperado %q", c.token, got, c.esperado)
			}
		})
	}
}

func TestExigeTokenDasMetricas(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	casos := []struct {
		nome, token, header string
		esperado            int
	}{
		{"token certo passa", "segredo", "Bearer segredo", http.StatusOK},
		{"sem cabeçalho é recusado", "segredo", "", http.StatusUnauthorized},
		{"token errado é recusado", "segredo", "Bearer outro", http.StatusUnauthorized},
		{"sem o prefixo Bearer é recusado", "segredo", "segredo", http.StatusUnauthorized},
		{"sem token configurado não confere", "", "", http.StatusOK},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}
			rec := httptest.NewRecorder()
			exigeTokenDasMetricas(c.token, ok).ServeHTTP(rec, req)
			if rec.Code != c.esperado {
				t.Errorf("status = %d, esperado %d", rec.Code, c.esperado)
			}
		})
	}
}
