package handler

import "testing"

// TestPapeisInstaladorInclueTechnician cobre o achado da auditoria: front-end
// (App.tsx allowedRoles de /instaladores) permite technician, mas o backend
// só liberava admin/developer/gestor — technician via a página, mas toda
// chamada de API (gerar .exe/.msi) vinha 403.
func TestPapeisInstaladorInclueTechnician(t *testing.T) {
	permitidos := []string{"admin", "developer", "gestor", "technician"}
	for _, r := range permitidos {
		if !papeisInstalador[r] {
			t.Errorf("papel %q deveria poder gerar instalador", r)
		}
	}

	if papeisInstalador["customer"] {
		t.Error("customer nunca deveria poder gerar instalador")
	}
}
