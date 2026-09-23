package lib

import "testing"

func ptr(s string) *string { return &s }

const (
	empresaA = "11111111-1111-1111-1111-111111111111"
	empresaB = "22222222-2222-2222-2222-222222222222"
)

// TestUserScopeGlobal fixa quem enxerga todas as empresas: só a equipe
// interna (Interna, vindo de public.is_equipe_interna — developer, ou
// technician/admin de empresa mãe). O papel sozinho não basta: admin e
// technician de empresa cliente ficam presos à própria empresa (ORN-SEC-01/02).
func TestUserScopeGlobal(t *testing.T) {
	casos := []struct {
		nome   string
		escopo UserScope
		quer   bool
	}{
		{"customer comum", UserScope{CompanyID: ptr(empresaA), Role: "customer"}, false},
		{"customer sem empresa", UserScope{CompanyID: nil, Role: "customer"}, false},
		{"technician de empresa cliente", UserScope{CompanyID: ptr(empresaA), Role: "technician"}, false},
		{"admin de empresa cliente", UserScope{CompanyID: ptr(empresaA), Role: "admin"}, false},
		{"technician da empresa mãe", UserScope{CompanyID: ptr(empresaA), Role: "technician", Interna: true}, true},
		{"admin da empresa mãe", UserScope{CompanyID: ptr(empresaA), Role: "admin", Interna: true}, true},
		{"developer", UserScope{CompanyID: ptr(empresaA), Role: "developer", Interna: true}, true},
	}
	for _, c := range casos {
		if got := c.escopo.Global(); got != c.quer {
			t.Errorf("%s: Global() = %v, esperado %v", c.nome, got, c.quer)
		}
	}
}

// TestUserScopeFiltroEmpresa garante que a equipe interna passa nil (o SQL
// trata NULL como "sem filtro") e que o resto passa a própria empresa.
func TestUserScopeFiltroEmpresa(t *testing.T) {
	for _, escopo := range []UserScope{
		{CompanyID: ptr(empresaA), Role: "customer"},
		{CompanyID: ptr(empresaA), Role: "admin"},
		{CompanyID: ptr(empresaA), Role: "technician"},
	} {
		if f := escopo.FiltroEmpresa(); f == nil || *f != empresaA {
			t.Errorf("%s de empresa cliente deveria filtrar pela própria empresa, veio %v", escopo.Role, f)
		}
	}

	interno := UserScope{CompanyID: ptr(empresaA), Role: "technician", Interna: true}
	if f := interno.FiltroEmpresa(); f != nil {
		t.Errorf("equipe interna não deveria filtrar, veio %v", *f)
	}
}

// TestUserScopePodeVerEmpresa cobre o caso central do vuln-0003 (usuário da
// empresa A lendo dado da empresa B) e o tratamento de company_id nulo.
func TestUserScopePodeVerEmpresa(t *testing.T) {
	for _, role := range []string{"customer", "admin", "technician"} {
		escopo := UserScope{CompanyID: ptr(empresaA), Role: role}
		if !escopo.PodeVerEmpresa(ptr(empresaA)) {
			t.Errorf("%s deveria ver dado da própria empresa", role)
		}
		if escopo.PodeVerEmpresa(ptr(empresaB)) {
			t.Errorf("VAZAMENTO: %s da empresa A viu dado da empresa B", role)
		}
		if escopo.PodeVerEmpresa(nil) {
			t.Errorf("dado órfão (company_id nulo) não deveria ser visível a %s de empresa cliente", role)
		}
	}

	semEmpresa := UserScope{CompanyID: nil, Role: "customer"}
	if semEmpresa.PodeVerEmpresa(ptr(empresaA)) {
		t.Error("usuário sem empresa não deveria ver dado de empresa alguma")
	}

	// Equipe interna vê tudo, inclusive dado órfão.
	interno := UserScope{CompanyID: ptr(empresaA), Role: "admin", Interna: true}
	for _, alvo := range []*string{ptr(empresaA), ptr(empresaB), nil} {
		if !interno.PodeVerEmpresa(alvo) {
			t.Errorf("equipe interna deveria ver empresa %v", alvo)
		}
	}
}
