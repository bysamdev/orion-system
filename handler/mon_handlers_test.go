package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion-api/lib"
)

// TestMonitoringForceUpdateMachine_ExigeAuth e
// TestMonitoringForceUpdateOutdated_ExigeAuth cobrem o caminho sem token —
// os dois endpoints de "forçar atualização" (painel Orion System, botão
// manual pra empurrar a versão mais recente sem esperar o heartbeat
// detectar sozinho) precisam recusar antes de tocar em qualquer coisa,
// mesmo padrão de TestMergeUsers_ExigeAuth em fn_handlers_test.go.
func TestMonitoringForceUpdateMachine_ExigeAuth(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/monitoring/machines/qualquer-id/force-update", nil)

	monitoringForceUpdateMachine(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401 (sem token)", rec.Code)
	}
}

func TestMonitoringForceUpdateOutdated_ExigeAuth(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/monitoring/machines/force-update-outdated", nil)

	monitoringForceUpdateOutdated(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401 (sem token)", rec.Code)
	}
}

// TestAutorizarComandoRemoto cobre os três cenários exigidos pela auditoria:
// customer nunca pode enviar comando remoto, técnico/admin de uma empresa não
// pode comandar máquina de outra, e técnico/admin da empresa certa funciona.
func TestAutorizarComandoRemoto(t *testing.T) {
	empresaA := "empresa-a"
	empresaB := "empresa-b"

	casos := []struct {
		nome             string
		escopo           lib.UserScope
		machineCompanyID *string
		permitido        bool
	}{
		{
			nome:             "customer da empresa certa é negado",
			escopo:           lib.UserScope{Role: "customer", CompanyID: &empresaA},
			machineCompanyID: &empresaA,
			permitido:        false,
		},
		{
			nome:             "customer sem empresa é negado",
			escopo:           lib.UserScope{Role: "customer"},
			machineCompanyID: &empresaA,
			permitido:        false,
		},
		{
			nome:             "technician de outra empresa é negado (SEC-01)",
			escopo:           lib.UserScope{Role: "technician", CompanyID: &empresaB},
			machineCompanyID: &empresaA,
			permitido:        false,
		},
		{
			nome:             "admin de outra empresa é negado (SEC-01)",
			escopo:           lib.UserScope{Role: "admin", CompanyID: &empresaB},
			machineCompanyID: &empresaA,
			permitido:        false,
		},
		{
			nome:             "technician da empresa correta é permitido",
			escopo:           lib.UserScope{Role: "technician", CompanyID: &empresaA},
			machineCompanyID: &empresaA,
			permitido:        true,
		},
		{
			nome:             "admin da empresa correta é permitido",
			escopo:           lib.UserScope{Role: "admin", CompanyID: &empresaA},
			machineCompanyID: &empresaA,
			permitido:        true,
		},
		{
			nome:             "developer (escopo global) é permitido em qualquer empresa",
			escopo:           lib.UserScope{Role: "developer"},
			machineCompanyID: &empresaB,
			permitido:        true,
		},
		{
			nome:             "master (escopo global) é permitido em qualquer empresa",
			escopo:           lib.UserScope{Role: "admin", Master: true, CompanyID: &empresaA},
			machineCompanyID: &empresaB,
			permitido:        true,
		},
		{
			nome:             "máquina órfã (sem company_id) é negada pra escopo não-global",
			escopo:           lib.UserScope{Role: "admin", CompanyID: &empresaA},
			machineCompanyID: nil,
			permitido:        false,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			permitido, msg := autorizarComandoRemoto(c.escopo, c.machineCompanyID)
			if permitido != c.permitido {
				t.Errorf("autorizarComandoRemoto(%+v, %v) = %v, esperado %v (msg=%q)",
					c.escopo, c.machineCompanyID, permitido, c.permitido, msg)
			}
			if !permitido && msg == "" {
				t.Error("negado sem mensagem de erro")
			}
			if permitido && msg != "" {
				t.Errorf("permitido mas com mensagem de erro: %q", msg)
			}
		})
	}
}
