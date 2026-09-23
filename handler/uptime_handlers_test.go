package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestWebEndpointMutationsExigemAuth cobre achado da auditoria item 6:
// monitoringCreateWebEndpoint/monitoringDeleteWebEndpoint (mutações de
// /api/monitoring/web/endpoints, por trás de /monitoramento-web no front)
// checavam só requireAuth, sem checagem de role — customer autenticado
// conseguia criar/apagar endpoint de monitoramento via API direta mesmo
// bloqueado na tela. Corrigido reaproveitando papeisComandoRemoto (mesma
// allow-list de monitoringCreateCommand). Sem DB/Supabase mockável neste
// pacote, o teste cobre o que dá pra verificar sem rede: sem token,
// nenhuma das duas rotas chega perto de mutar dado (401 antes até do
// db==nil comprometer o teste). A allow-list de role em si já é coberta
// por TestAutorizarComandoRemoto (mesmo mapa, reaproveitado aqui).
func TestWebEndpointMutationsExigemAuth(t *testing.T) {
	casos := []struct {
		nome    string
		metodo  string
		caminho string
		handler http.HandlerFunc
	}{
		{"create sem auth", http.MethodPost, "/api/monitoring/web/endpoints", monitoringCreateWebEndpoint},
		{"delete sem auth", http.MethodDelete, "/api/monitoring/web/endpoints/x", monitoringDeleteWebEndpoint},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(c.metodo, c.caminho, nil)
			c.handler(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, esperado 401 (sem token)", rec.Code)
			}
		})
	}
}
