package lib

import "testing"

func ptr(s string) *string { return &s }

const (
	empresaA = "11111111-1111-1111-1111-111111111111"
	empresaB = "22222222-2222-2222-2222-222222222222"
)

// TestUserScopeGlobal fixa quem enxerga todas as empresas: empresa master ou
// papel developer — a mesma condição das policies de RLS em
// 20260614000001_enable_rls_machines.sql.
func TestUserScopeGlobal(t *testing.T) {
	casos := []struct {
		nome   string
		escopo UserScope
		quer   bool
	}{
		{"customer comum", UserScope{CompanyID: ptr(empresaA), Role: "customer"}, false},
		{"technician comum", UserScope{CompanyID: ptr(empresaA), Role: "technician"}, false},
		{"admin de cliente", UserScope{CompanyID: ptr(empresaA), Role: "admin"}, false},
		{"developer", UserScope{CompanyID: ptr(empresaA), Role: "developer"}, true},
		{"empresa master", UserScope{CompanyID: ptr(empresaA), Role: "admin", Master: true}, true},
		{"master + customer", UserScope{CompanyID: ptr(empresaA), Role: "customer", Master: true}, true},
	}
	for _, c := range casos {
		if got := c.escopo.Global(); got != c.quer {
			t.Errorf("%s: Global() = %v, esperado %v", c.nome, got, c.quer)
		}
	}
}

// TestUserScopeFiltroEmpresa garante que quem vê tudo passa nil (o SQL trata
// NULL como "sem filtro") e que os demais passam a própria empresa.
func TestUserScopeFiltroEmpresa(t *testing.T) {
	comum := UserScope{CompanyID: ptr(empresaA), Role: "admin"}
	if f := comum.FiltroEmpresa(); f == nil || *f != empresaA {
		t.Errorf("admin de cliente deveria filtrar pela própria empresa, veio %v", f)
	}

	dev := UserScope{CompanyID: ptr(empresaA), Role: "developer"}
	if f := dev.FiltroEmpresa(); f != nil {
		t.Errorf("developer não deveria filtrar, veio %v", *f)
	}

	master := UserScope{CompanyID: ptr(empresaA), Role: "customer", Master: true}
	if f := master.FiltroEmpresa(); f != nil {
		t.Errorf("empresa master não deveria filtrar, veio %v", *f)
	}
}

// TestUserScopePodeVerEmpresa cobre o caso central do vuln-0003 (usuário da
// empresa A lendo máquina da empresa B) e o tratamento de company_id nulo.
func TestUserScopePodeVerEmpresa(t *testing.T) {
	usuarioA := UserScope{CompanyID: ptr(empresaA), Role: "admin"}

	if !usuarioA.PodeVerEmpresa(ptr(empresaA)) {
		t.Error("usuário deveria ver máquina da própria empresa")
	}
	if usuarioA.PodeVerEmpresa(ptr(empresaB)) {
		t.Error("VAZAMENTO: usuário da empresa A viu máquina da empresa B")
	}
	if usuarioA.PodeVerEmpresa(nil) {
		t.Error("máquina órfã (company_id nulo) não deveria ser visível a usuário comum")
	}

	// Usuário sem empresa no perfil não vê nada escopado.
	semEmpresa := UserScope{CompanyID: nil, Role: "customer"}
	if semEmpresa.PodeVerEmpresa(ptr(empresaA)) {
		t.Error("usuário sem empresa não deveria ver máquina de empresa alguma")
	}

	// Quem vê tudo vê inclusive dado órfão.
	dev := UserScope{CompanyID: ptr(empresaA), Role: "developer"}
	for _, alvo := range []*string{ptr(empresaA), ptr(empresaB), nil} {
		if !dev.PodeVerEmpresa(alvo) {
			t.Errorf("developer deveria ver empresa %v", alvo)
		}
	}
}
