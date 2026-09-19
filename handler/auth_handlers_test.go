package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestNomeRequisitante: o perfil da máquina que assina os chamados
// automáticos mostra quem está logado no Windows agora, quando o agente sabe.
func TestNomeRequisitante(t *testing.T) {
	usuario := "joao.silva"

	casos := []struct {
		nome        string
		hostname    string
		currentUser *string
		esperado    string
	}{
		{"usuário Windows logado", "PC-VENDAS-03", &usuario, "joao.silva (PC-VENDAS-03)"},
		{"sem usuário resolvido (nil)", "PC-VENDAS-03", nil, "Suporte (PC-VENDAS-03)"},
		{"current_user vazio", "PC-VENDAS-03", strPtr(""), "Suporte (PC-VENDAS-03)"},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := nomeRequisitante(c.hostname, c.currentUser); got != c.esperado {
				t.Errorf("nomeRequisitante(%q, %v) = %q, esperado %q", c.hostname, c.currentUser, got, c.esperado)
			}
		})
	}
}

func strPtr(s string) *string { return &s }

// TestMachineLoginSoLevaParaOLogin: o login sem senha pelo agente foi
// retirado. Com ou sem token, a rota só manda para a tela de login, sem
// abrir sessão nem repassar o token.
func TestMachineLoginSoLevaParaOLogin(t *testing.T) {
	for _, caminho := range []string{
		"/api/auth/machine-login",
		"/api/auth/machine-login?token=abc123&redirect_to=/novo-ticket&requester_user=joao",
	} {
		rec := httptest.NewRecorder()
		machineLogin(rec, httptest.NewRequest(http.MethodGet, caminho, nil))

		if rec.Code != http.StatusSeeOther {
			t.Errorf("%s: status %d, esperado 303", caminho, rec.Code)
		}
		if destino := rec.Header().Get("Location"); destino != "/auth" {
			t.Errorf("%s: redirecionou para %q, esperado /auth", caminho, destino)
		}
		if rec.Header().Get("Set-Cookie") != "" {
			t.Errorf("%s: não deveria abrir sessão", caminho)
		}
	}
}
