package handler

import (
	"fmt"
	"net/http"
	"strings"

	"orion-api/lib"
)

// machineLogin lida com o acesso simplificado (passwordless) para máquinas que possuem o Orion Agent.
// Este endpoint é chamado quando o usuário clica em "Abrir Portal" no menu da bandeja do Windows.
// Rota: GET /api/auth/machine-login?token=<TOKEN_DA_MAQUINA>
func machineLogin(w http.ResponseWriter, r *http.Request) {
	// 1. Extraímos o token que identifica essa instalação específica do agente.
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Ops! O token de identificação da máquina está ausente.", http.StatusBadRequest)
		return
	}

	if db == nil {
		http.Error(w, "O serviço de banco de dados está temporariamente indisponível.", http.StatusServiceUnavailable)
		return
	}

	// 2. Validamos se a máquina existe e a qual empresa ela pertence.
	m, companyID, err := db.MachineByToken(r.Context(), token)
	if err != nil {
		http.Error(w, "Não conseguimos reconhecer esta máquina. Verifique se o agente está configurado corretamente.", http.StatusUnauthorized)
		return
	}

	// 3. Montamos a identidade digital desta máquina no sistema.
	// Criamos um e-mail técnico interno para que o Supabase Auth possa gerenciar a sessão.
	tokenPrefix := token
	if len(token) > 12 {
		tokenPrefix = token[:12]
	}
	machineEmail := strings.ToLower(fmt.Sprintf("machine-%s@orion.internal", tokenPrefix))
	machineName := fmt.Sprintf("Suporte (%s)", m.Hostname)

	// 4. Verificamos se esta máquina já tem um "usuário-fantasma" registrado.
	userID, err := db.AuthUserIDByEmail(r.Context(), machineEmail)
	if err != nil {
		// Se for a primeira vez, criamos o registro de autenticação com uma senha aleatória longa.
		in := lib.CreateUserInput{
			Email:        machineEmail,
			Password:     lib.GenerateRandomPassword(24),
			EmailConfirm: true, // Já confirmamos internamente
			UserMetadata: map[string]interface{}{
				"full_name": machineName,
			},
		}
		out, err := sb.AdminCreateUser(r.Context(), in)
		if err != nil {
			http.Error(w, fmt.Sprintf("Erro técnico ao registrar a máquina: %v", err), http.StatusInternalServerError)
			return
		}
		userID = out.User.ID

		// Criamos ou atualizamos o perfil público da máquina (nome e empresa).
		_ = db.UpdateProfile(r.Context(), userID, lib.ProfileUpdate{
			FullName:   &machineName,
			Email:      &machineEmail,
			CompanyID:  &companyID,
		})
	} else {
		// Se a máquina já é nossa conhecida, apenas garantimos que os dados (nome/empresa) estão atualizados.
		_ = db.UpdateProfile(r.Context(), userID, lib.ProfileUpdate{
			FullName:  &machineName,
			CompanyID: &companyID,
		})
	}

	// 5. Geramos um "Link Mágico" (Magic Link) de uso único para logar o usuário automaticamente.
	// Isso evita que o cliente precise digitar uma senha no navegador.
	loginLink, err := sb.AdminGenerateLink(r.Context(), lib.GenerateLinkInput{
		Type:       "magiclink",
		Email:      machineEmail,
		RedirectTo: "/", // Após logar, enviamos o usuário direto para a Home.
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("Falha ao gerar seu link de acesso rápido: %v", err), http.StatusInternalServerError)
		return
	}

	// 6. Redirecionamento Final
	// O navegador do usuário será levado para o portal Orion já autenticado.
	http.Redirect(w, r, loginLink, http.StatusTemporaryRedirect)
}
