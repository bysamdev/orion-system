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

// TestMonitoringMachineTickets_ExigeAuth cobre o histórico de chamados por
// máquina (ver lib.MachineGhostEmail/db.TicketsByUserID) — mesmo padrão de
// 401 sem token que os outros endpoints de máquina.
func TestMonitoringMachineTickets_ExigeAuth(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/monitoring/machines/qualquer-id/tickets", nil)

	monitoringMachineTickets(rec, req)

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

// TestAutorizarComandoRemoto cobre a política atual: customer nunca pode
// enviar comando remoto (só vê seus próprios chamados); technician/admin/
// developer têm visão MSP-wide por decisão de produto e podem comandar
// máquina de qualquer empresa, inclusive máquina órfã (sem company_id).
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
			nome:             "technician de outra empresa é permitido (visão MSP-wide)",
			escopo:           lib.UserScope{Role: "technician", CompanyID: &empresaB},
			machineCompanyID: &empresaA,
			permitido:        true,
		},
		{
			nome:             "admin de outra empresa é permitido (visão MSP-wide)",
			escopo:           lib.UserScope{Role: "admin", CompanyID: &empresaB},
			machineCompanyID: &empresaA,
			permitido:        true,
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
			nome:             "máquina órfã (sem company_id) é permitida pra escopo global",
			escopo:           lib.UserScope{Role: "admin", CompanyID: &empresaA},
			machineCompanyID: nil,
			permitido:        true,
		},
		{
			nome:             "máquina órfã (sem company_id) é negada pra customer",
			escopo:           lib.UserScope{Role: "customer", CompanyID: &empresaA},
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

// TestComandoRemotoPermitido cobre a allowlist de conteúdo de
// monitoringCreateCommand: antes desta correção, qualquer papel autorizado
// (papeisComandoRemoto) podia mandar qualquer string não-vazia, que virava
// `cmd.exe /C <string>` na máquina do cliente — alcançável direto pela API,
// sem depender da UI só oferecer os 4 botões fixos de "Ações Rápidas".
func TestComandoRemotoPermitido(t *testing.T) {
	casos := []struct {
		nome      string
		command   string
		permitido bool
	}{
		{"ping das ações rápidas", "ping 8.8.8.8", true},
		{"flush dns das ações rápidas", "ipconfig /flushdns", true},
		{"reset do spooler das ações rápidas", "net stop spooler & net start spooler", true},
		{"limpar temp das ações rápidas", `del /q /f /s %temp%\*`, true},
		{"orion-start-terminal (RemoteTerminal.tsx manda por esta rota)", "orion-start-terminal", true},
		{"netstat -an (achado no histórico real de machine_commands)", "netstat -an", true},
		{"chkdsk C: (achado no histórico real de machine_commands)", "chkdsk C:", true},
		{"espaço em volta não escapa a allowlist", "  ping 8.8.8.8  ", true},
		{"comando arbitrário é negado", "net user hacker Senha123! /add", false},
		{"tentativa de esconder comando dentro de um permitido é negada", "ping 8.8.8.8 & net user hacker Senha123! /add", false},
		{"orion-install não é aceito por esta rota (só db.CreateCommand direto)", `orion-install --url="https://x" --hash="abc"`, false},
		{"string vazia é negada", "", false},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := comandoRemotoPermitido(c.command); got != c.permitido {
				t.Errorf("comandoRemotoPermitido(%q) = %v, esperado %v", c.command, got, c.permitido)
			}
		})
	}
}
