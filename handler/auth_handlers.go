package handler

import (
	"fmt"
	"net/http"
	"strings"

	"orion-api/lib"
)

// machineLogin handles passwordless login for machines using a token.
// GET /api/auth/machine-login?token=<MACHINE_TOKEN>
func machineLogin(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Token de máquina ausente", http.StatusBadRequest)
		return
	}

	if db == nil {
		http.Error(w, "Banco de dados não disponível", http.StatusServiceUnavailable)
		return
	}

	// 1. Validar máquina e obter empresa
	m, companyID, err := db.MachineByToken(r.Context(), token)
	if err != nil {
		http.Error(w, "Máquina ou token inválido", http.StatusUnauthorized)
		return
	}

	// 2. Definir e-mail do "usuário-fantasma" para esta máquina
	// Usamos o prefixo do token para manter consistência
	tokenPrefix := token
	if len(token) > 12 {
		tokenPrefix = token[:12]
	}
	machineEmail := strings.ToLower(fmt.Sprintf("machine-%s@orion.internal", tokenPrefix))
	machineName := fmt.Sprintf("Suporte (%s)", m.Hostname)

	// 3. Verificar se o usuário já existe no Supabase Auth
	userID, err := db.AuthUserIDByEmail(r.Context(), machineEmail)
	if err != nil {
		// Criar novo usuário se não existir
		in := lib.CreateUserInput{
			Email:        machineEmail,
			Password:     lib.GenerateRandomPassword(24),
			EmailConfirm: true,
			UserMetadata: map[string]interface{}{
				"full_name": machineName,
			},
		}
		out, err := sb.AdminCreateUser(r.Context(), in)
		if err != nil {
			http.Error(w, fmt.Sprintf("Erro ao criar usuário de máquina: %v", err), http.StatusInternalServerError)
			return
		}
		userID = out.User.ID

		// Garantir perfil e empresa
		_ = db.UpdateProfile(r.Context(), userID, lib.ProfileUpdate{
			FullName:   &machineName,
			Email:      &machineEmail,
			CompanyID:  &companyID,
		})
	}

	// 4. Gerar link de login mágico (Magic Link) que ignora confirmação de e-mail
	loginLink, err := sb.AdminGenerateLink(r.Context(), lib.GenerateLinkInput{
		Type:       "magiclink",
		Email:      machineEmail,
		RedirectTo: "/tickets", 
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("Erro ao gerar link de acesso: %v", err), http.StatusInternalServerError)
		return
	}

	// 5. Redirecionar o usuário para o portal já logado
	http.Redirect(w, r, loginLink, http.StatusTemporaryRedirect)
}
