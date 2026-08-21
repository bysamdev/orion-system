package handler

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"golang.org/x/sync/errgroup"

	"orion-api/lib"
)

// nomeRequisitante decide o nome exibido no chamado/perfil-fantasma da
// máquina. Reflete quem está logado no Windows AGORA (currentUser, gravado
// em machines.current_user a cada heartbeat — 60s), não fica travado no
// primeiro usuário que já usou a máquina: ela pode trocar de setor/pessoa e
// o requester do chamado precisa acompanhar quem realmente abriu, não quem
// usava a máquina há meses. O e-mail-fantasma que autentica a sessão segue
// fixo por máquina (não muda, ver machineEmail em machineLogin) — só o nome
// exibido muda.
func nomeRequisitante(hostname string, currentUser *string) string {
	if currentUser != nil && *currentUser != "" {
		return fmt.Sprintf("%s (%s)", *currentUser, hostname)
	}
	return fmt.Sprintf("Suporte (%s)", hostname)
}

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
	// O prefixo "/" sozinho NÃO basta: "//evil.com" e "/\evil.com" também começam
	// com "/" e o navegador os resolve como URL absoluta para outro host
	// (referência protocol-relative). Exigimos um caminho same-origin de verdade:
	// uma única "/" inicial, sem barra invertida e sem "://" em nenhum ponto.
	redirectPath := r.URL.Query().Get("redirect_to")
	if !caminhoRelativoSeguro(redirectPath) {
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
	machineName := nomeRequisitante(m.Hostname, m.CurrentUser)

	// 4. Verificamos se esta máquina já tem um "usuário-fantasma" registrado.
	var profileUpdate lib.ProfileUpdate
	userID, err := db.AuthUserIDByEmail(r.Context(), machineEmail)
	if err != nil {
		// Se for a primeira vez, criamos o registro de autenticação com uma senha aleatória longa.
		// Este passo É sequencial de verdade (não dá para paralelizar com o passo
		// 5 abaixo): AdminGenerateLink exige que o usuário já exista em auth.users.
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
		profileUpdate = lib.ProfileUpdate{FullName: &machineName, Email: &machineEmail, CompanyID: &companyID}
	} else {
		// Se a máquina já é nossa conhecida, apenas garantimos que os dados (nome/empresa) estão atualizados.
		profileUpdate = lib.ProfileUpdate{FullName: &machineName, CompanyID: &companyID}
	}

	// 5. Atualizamos o perfil público (nome/empresa) e geramos o "Link Mágico"
	// de uso único, em paralelo (correção C.5).
	//
	// As duas chamadas são independentes: UpdateProfile escreve em
	// public.profiles, AdminGenerateLink lê/gera em auth.users — nenhuma
	// depende do resultado da outra, as duas só precisam de userID/
	// machineEmail, já conhecidos neste ponto. Antes rodavam em série (dois
	// round-trips somados); em paralelo, o tempo de parede passa a ser o
	// mais lento dos dois, não a soma.
	//
	// O erro de UpdateProfile é deliberadamente descartado — mesmo
	// comportamento de antes desta correção (o "_ = " original): uma falha
	// ao atualizar o perfil não pode impedir o login. Usamos errgroup (não
	// apenas goroutine solta) porque este handler roda numa função
	// serverless da Vercel — o ambiente de execução pode ser suspenso assim
	// que a resposta HTTP é enviada, então uma goroutine verdadeiramente
	// "fire-and-forget" arriscaria ser morta no meio; esperamos as duas
	// terminarem antes de prosseguir para o redirect.
	//
	// Correção C.3 (RedirectTo absoluto): o GoTrue exige URL absoluta e
	// valida contra a allowlist de redirect URLs do projeto. Um caminho
	// relativo como "/novo-ticket" era aceito sem erro aqui, mas rejeitado
	// silenciosamente pelo GoTrue, que caía no SITE_URL padrão — na prática,
	// "Abrir Chamado" na bandeja levava para a home em vez de /novo-ticket
	// (achado documentado em orion-agent/TRAY-UX.md §1).
	//
	// IMPORTANTE, verificação que este código NÃO cobre: essa allowlist não é
	// visível nem editável pelas ferramentas disponíveis aqui — confirmar
	// manualmente que "https://<domínio>/novo-ticket" está cadastrado lá no
	// painel do Supabase (Authentication > URL Configuration), senão o
	// sintoma volta a aparecer mesmo com esta correção.
	var loginLink string
	g, gctx := errgroup.WithContext(r.Context())

	g.Go(func() error {
		_ = db.UpdateProfile(gctx, userID, profileUpdate)
		return nil
	})
	g.Go(func() error {
		link, err := sb.AdminGenerateLink(gctx, lib.GenerateLinkInput{
			Type:       "magiclink",
			Email:      machineEmail,
			RedirectTo: absoluteURL(r, redirectPath), // Redireciona para o destino solicitado (/ ou /novo-ticket)
		})
		if err != nil {
			return fmt.Errorf("falha ao gerar seu link de acesso rápido: %w", err)
		}
		loginLink = link
		return nil
	})

	if err := g.Wait(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 6. Redirecionamento Final
	// O navegador do usuário será levado para o portal Orion já autenticado.
	http.Redirect(w, r, loginLink, http.StatusTemporaryRedirect)
}

// caminhoRelativoSeguro decide se um valor vindo de ?redirect_to= pode ser
// usado como destino pós-login sem sair da origem da aplicação.
//
// Só aceita caminho same-origin: uma única "/" inicial. Rejeita explicitamente
// as três formas que passam por um teste ingênuo de HasPrefix(v, "/"):
//
//	"//evil.com"   → protocol-relative; o navegador resolve como https://evil.com
//	"/\evil.com"   → navegadores normalizam "\" em "/", virando o caso acima
//	"/x?u=http://" → qualquer esquema embutido no restante do caminho
func caminhoRelativoSeguro(v string) bool {
	if v == "" || !strings.HasPrefix(v, "/") {
		return false
	}
	if strings.HasPrefix(v, "//") {
		return false
	}
	if strings.ContainsAny(v, "\\\r\n") {
		return false
	}
	return !strings.Contains(v, "://")
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
