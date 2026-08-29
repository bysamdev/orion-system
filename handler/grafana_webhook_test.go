package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Estes testes cobrem só o portão de autenticação de
// monitoringGrafanaAlertWebhook — a parte que dá pra exercitar sem um banco
// real conectado (db fica nil neste ambiente de teste; qualquer caminho que
// chegasse a db.InsertAlertIfNotExists entraria em pânico). O portão
// precisa rejeitar ANTES de tocar em db nos dois casos abaixo.

func TestGrafanaWebhook_SemSegredoConfiguradoSempreRejeita(t *testing.T) {
	original := cfg.GrafanaWebhookSecret
	cfg.GrafanaWebhookSecret = ""
	defer func() { cfg.GrafanaWebhookSecret = original }()

	req := httptest.NewRequest(http.MethodPost, "/api/monitoring/alerts/webhook/grafana", strings.NewReader(`{}`))
	// mesmo um Authorization vazio não deve "casar" com uma config vazia
	rec := httptest.NewRecorder()

	monitoringGrafanaAlertWebhook(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado %d (endpoint sem GRAFANA_WEBHOOK_SECRET configurado deve ficar sempre fechado)", rec.Code, http.StatusUnauthorized)
	}
}

func TestGrafanaWebhook_SegredoIncorretoRejeita(t *testing.T) {
	original := cfg.GrafanaWebhookSecret
	cfg.GrafanaWebhookSecret = "segredo-correto-de-teste"
	defer func() { cfg.GrafanaWebhookSecret = original }()

	req := httptest.NewRequest(http.MethodPost, "/api/monitoring/alerts/webhook/grafana", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer segredo-errado")
	rec := httptest.NewRecorder()

	monitoringGrafanaAlertWebhook(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado %d (segredo incorreto deve ser rejeitado)", rec.Code, http.StatusUnauthorized)
	}
}

func TestAfetaStatusDaMaquina(t *testing.T) {
	casos := map[string]bool{
		"Agente Offline":          true,
		"Servidor Debian Offline": true,
		"CPU Alto Sustentado":     false,
		"":                        false,
	}
	for alertType, esperado := range casos {
		if got := afetaStatusDaMaquina(alertType); got != esperado {
			t.Errorf("afetaStatusDaMaquina(%q) = %v, esperado %v", alertType, got, esperado)
		}
	}
}

func TestGrafanaWebhook_CorpoInvalidoAposSegredoCorretoRejeitaSemPanico(t *testing.T) {
	original := cfg.GrafanaWebhookSecret
	cfg.GrafanaWebhookSecret = "segredo-correto-de-teste"
	defer func() { cfg.GrafanaWebhookSecret = original }()

	req := httptest.NewRequest(http.MethodPost, "/api/monitoring/alerts/webhook/grafana", strings.NewReader(`{nao-e-json`))
	req.Header.Set("Authorization", "Bearer segredo-correto-de-teste")
	rec := httptest.NewRecorder()

	monitoringGrafanaAlertWebhook(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, esperado %d (corpo JSON inválido)", rec.Code, http.StatusBadRequest)
	}
}
