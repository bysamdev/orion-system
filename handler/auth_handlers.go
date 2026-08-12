package handler

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"orion-api/lib"
)

// machineLogin lida com o acesso simplificado (passwordless) para máquinas que possuem o Orion Agent.
// Este endpoint é chamado quando o usuário clica em "Abrir Portal" no menu da bandeja do Windows.
// Rota: GET /api/auth/machine-login?token=<TOKEN_DA_MAQUINA>
func machineLogin(w http.ResponseWriter, r *http.Request) {
	// Correção A.3: este é o endpoint mais exposto do sistema — concede sessão
	// autenticada sem exigir NENHUMA credencial além do token na query string
	// (ver SECURITY-AUTO-PROVISIONING.md §1.3). Sem limite algum, é o alvo
	// direto de um brute-force/scan tentando adivinhar tokens de máquinas já
	// registradas. Checado antes de qualquer trabalho (parse, banco).
	ip := lib.ClientIP(r)
	if !limiterMachineLogin.Permitir(ip) {
		log.Printf("[ALERTA] machine-login: limite de taxa excedido para IP %s", ip)
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
			"error": "muitas tentativas — aguarde um minuto e tente novamente",
		})
		return
	}

	// 1. Extraímos o token que identifica essa instalação específica do agente.
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Ops! O token de identificação da máquina está ausente.", http.StatusBadRequest)
		return
	}

	// Lemos o destino desejado após o login (ex: /novo-ticket).
	// Apenas caminhos relativos são permitidos na entrada — evita
	// redirecionamento aberto via um valor de query totalmente controlado
	// pelo chamador (ex.: "redirect_to=https://phishing.example").
	redirectPath := r.URL.Query().Get("redirect_to")
	if redirectPath == "" || !strings.HasPrefix(redirectPath, "/") {
		redirectPath = "/"
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
	//
	// Correção C.3: RedirectTo precisa ser uma URL ABSOLUTA — o GoTrue (Auth
	// do Supabase) exige isso e valida contra a allowlist de redirect URLs
	// configurada no projeto. Um caminho relativo como "/novo-ticket" era
	// aceito sem erro aqui, mas rejeitado silenciosamente pelo GoTrue, que
	// caía no SITE_URL padrão — na prática, "Abrir Chamado" na bandeja levava
	// para a home em vez de /novo-ticket (achado documentado em
	// orion-agent/TRAY-UX.md §1).
	//
	// IMPORTANTE, verificação que este código NÃO cobre: o GoTrue só aceita
	// um redirect_to se ele estiver na allowlist configurada no painel do
	// Supabase (Authentication > URL Configuration). Essa allowlist não é
	// visível nem editável pelas ferramentas disponíveis aqui — confirmar
	// manualmente que "https://<domínio>/novo-ticket" está cadastrado lá,
	// senão o sintoma volta a aparecer mesmo com esta correção.
	loginLink, err := sb.AdminGenerateLink(r.Context(), lib.GenerateLinkInput{
		Type:       "magiclink",
		Email:      machineEmail,
		RedirectTo: absoluteURL(r, redirectPath), // Redireciona para o destino solicitado (/ ou /novo-ticket)
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("Falha ao gerar seu link de acesso rápido: %v", err), http.StatusInternalServerError)
		return
	}

	// 6. Redirecionamento Final
	// O navegador do usuário será levado para o portal Orion já autenticado.
	http.Redirect(w, r, loginLink, http.StatusTemporaryRedirect)
}

// absoluteURL converte um caminho relativo (já validado como começando com
// "/" pelo chamador) numa URL absoluta, usando o host da própria requisição.
//
// Não introduz uma nova variável de ambiente (ex.: SITE_URL) porque o
// backend roda atrás do proxy da Vercel, que só encaminha requisições cujo
// Host já corresponde a um domínio de fato configurado para este projeto —
// nesse contexto de hospedagem, confiar em r.Host para montar o destino do
// redirect é seguro, e evita duplicar o domínio como uma terceira constante
// (já existem duas: lib.Config.LoginURL e InviteURL, ambas hardcoded para
// "https://orion.bysam.dev").
func absoluteURL(r *http.Request, path string) string {
	scheme := "https"
	if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
		scheme = p
	} else if r.TLS == nil {
		scheme = "http" // dev local, sem proxy nem TLS
	}
	return fmt.Sprintf("%s://%s%s", scheme, r.Host, path)
}
