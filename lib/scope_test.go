package lib

import "testing"

func ptr(s string) *string { return &s }

const (
	empresaA = "11111111-1111-1111-1111-111111111111"
	empresaB = "22222222-2222-2222-2222-222222222222"
)

// TestUserScopeGlobal fixa quem enxerga todas as empresas: qualquer papel
// exceto customer tem visão MSP-wide, independente da empresa a que
// pertence — só customer é restrito à própria empresa (só precisa ver seus
// próprios chamados). Substituiu a checagem antiga por ILIKE no nome da
// empresa ("Orion System"/"iBReady"/"bysamdev"), que concedia visão global a
// qualquer papel — inclusive technician — só por pertencer a uma dessas
// empresas (achado real de auditoria E2E: técnico via máquinas de outro
// tenant).
func TestUserScopeGlobal(t *testing.T) {
	casos := []struct {
		nome   string
		escopo UserScope
		quer   bool
	}{
		{"customer comum", UserScope{CompanyID: ptr(empresaA), Role: "customer"}, false},
		{"customer sem empresa", UserScope{CompanyID: nil, Role: "customer"}, false},
		{"technician", UserScope{CompanyID: ptr(empresaA), Role: "technician"}, true},
		{"admin", UserScope{CompanyID: ptr(empresaA), Role: "admin"}, true},
		{"developer", UserScope{CompanyID: ptr(empresaA), Role: "developer"}, true},
	}
	for _, c := range casos {
		if got := c.escopo.Global(); got != c.quer {
			t.Errorf("%s: Global() = %v, esperado %v", c.nome, got, c.quer)
		}
	}
}

// TestUserScopeFiltroEmpresa garante que quem vê tudo passa nil (o SQL trata
// NULL como "sem filtro") e que customer passa a própria empresa.
func TestUserScopeFiltroEmpresa(t *testing.T) {
	customer := UserScope{CompanyID: ptr(empresaA), Role: "customer"}
	if f := customer.FiltroEmpresa(); f == nil || *f != empresaA {
		t.Errorf("customer deveria filtrar pela própria empresa, veio %v", f)
	}

	tecnico := UserScope{CompanyID: ptr(empresaA), Role: "technician"}
	if f := tecnico.FiltroEmpresa(); f != nil {
		t.Errorf("technician não deveria filtrar, veio %v", *f)
	}

	dev := UserScope{CompanyID: ptr(empresaA), Role: "developer"}
	if f := dev.FiltroEmpresa(); f != nil {
		t.Errorf("developer não deveria filtrar, veio %v", *f)
	}
}

// TestUserScopePodeVerEmpresa cobre o caso central do vuln-0003 (customer da
// empresa A lendo máquina da empresa B) e o tratamento de company_id nulo.
// technician/admin/developer têm visão MSP-wide por decisão de produto, não
// são escopados por empresa.
func TestUserScopePodeVerEmpresa(t *testing.T) {
	customerA := UserScope{CompanyID: ptr(empresaA), Role: "customer"}

	if !customerA.PodeVerEmpresa(ptr(empresaA)) {
		t.Error("customer deveria ver máquina da própria empresa")
	}
	if customerA.PodeVerEmpresa(ptr(empresaB)) {
		t.Error("VAZAMENTO: customer da empresa A viu máquina da empresa B")
	}
	if customerA.PodeVerEmpresa(nil) {
		t.Error("máquina órfã (company_id nulo) não deveria ser visível a customer")
	}

	// Customer sem empresa no perfil não vê nada escopado.
	semEmpresa := UserScope{CompanyID: nil, Role: "customer"}
	if semEmpresa.PodeVerEmpresa(ptr(empresaA)) {
		t.Error("customer sem empresa não deveria ver máquina de empresa alguma")
	}

	// Quem vê tudo (qualquer papel != customer) vê inclusive dado órfão.
	for _, role := range []string{"technician", "admin", "developer"} {
		escopo := UserScope{CompanyID: ptr(empresaA), Role: role}
		for _, alvo := range []*string{ptr(empresaA), ptr(empresaB), nil} {
			if !escopo.PodeVerEmpresa(alvo) {
				t.Errorf("%s deveria ver empresa %v", role, alvo)
			}
		}
	}
}
