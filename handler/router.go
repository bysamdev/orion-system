package handler

// [...path].go — Vercel catch-all Go serverless function.
// This file contains the entry point and global initialization.
// All routes are handled by the chi router built in init().

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"orion-api/lib"
)

// ─── Package-level singletons (warm-start safe) ──────────────────────────────

var (
	once   sync.Once
	router http.Handler
	cfg    lib.Config
	db     *lib.DB
	sb     *lib.SupabaseClient
	mailer *lib.ResendClient

	// Rate limiters (correção A.3) — ver lib/ratelimit.go para a limitação
	// importante de rodar em memória, por instância, num backend serverless.
	//
	// machine-login é o mais sensível: não exige nenhuma credencial (só o
	// token da query string), então é o alvo mais direto para um
	// brute-force/scan tentando adivinhar tokens de máquinas — limite
	// apertado por IP.
	//
	// heartbeat exige X-Agent-Key, mas ainda assim se beneficia de um limite
	// generoso: protege contra uma chave vazada sendo usada para inundar o
	// endpoint. O limite é alto de propósito porque múltiplas máquinas de um
	// mesmo escritório costumam sair pelo mesmo IP público (NAT) — um limite
	// apertado aqui derrubaria heartbeats legítimos.
	limiterMachineLogin = lib.NewRateLimiter(1*time.Minute, 20)
	limiterHeartbeat    = lib.NewRateLimiter(1*time.Minute, 300)
)

func init() {
	once.Do(func() {
		cfg = lib.LoadConfig()

		if cfg.DatabaseURL != "" {
			d, err := lib.NewDB(cfg.DatabaseURL)
			if err == nil {
				db = d
			}
		}

		sb = lib.NewSupabaseClient(cfg.SupabaseURL, cfg.SupabaseAnonKey, cfg.SupabaseServiceKey)

		if cfg.ResendAPIKey != "" {
			mailer = lib.NewResend(cfg.ResendAPIKey, cfg.ResendFrom)
		}

		router = buildRouter()
		startNetworkPingWorker()
	})
}

// startNetworkPingWorker runs a background ticker every 5 minutes to probe network_links targets.
func startNetworkPingWorker() {
	go func() {
		time.Sleep(10 * time.Second)
		ticker := time.NewTicker(300 * time.Second)
		defer ticker.Stop()

		for {
			if db != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				_, _ = db.ProbeAllNetworkLinks(ctx)
				cancel()
			}
			<-ticker.C
		}
	}()
}

// Handler is the Vercel Go serverless function entry point.
func Handler(w http.ResponseWriter, r *http.Request) {
	router.ServeHTTP(w, r)
}

// buildRouter wires all routes.
func buildRouter() http.Handler {
	r := chi.NewRouter()
	// middleware.RealIP foi removido: ele sobrescrevia r.RemoteAddr com o valor
	// bruto de X-Forwarded-For / X-Real-IP / True-Client-IP enviado pelo próprio
	// cliente (GO-2026-5774/5775/5777, e por isso está deprecated na v5.3.1).
	// Como lib.ClientIP alimenta as chaves dos rate limiters, bastava variar o
	// header a cada requisição para ter tentativas ilimitadas em machine-login.
	//
	// ClientIPFromXFFTrustedProxies(n) pega a entrada na posição len(xff)-n:
	// a que o proxy mais externo *nosso* acrescentou — a única que o cliente não
	// consegue forjar. Na Vercel há exatamente 1 hop na frente da função.
	// TRUSTED_PROXY_COUNT permite ajustar sem recompilar se a topologia mudar.
	r.Use(middleware.ClientIPFromXFFTrustedProxies(proxiesConfiaveis()))
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(maxBodySizeMiddleware)
	r.Use(corsMiddleware)

	// ── Rotas com mecanismo de autenticação PRÓPRIO ───────────────────────────
	//
	// Ficam FORA de RequireCompanyScope de propósito — nenhuma delas recebe JWT
	// de usuário, então não há empresa de usuário a resolver. Cada uma tem sua
	// própria barreira, indicada ao lado:
	//
	//   machine-login              token da máquina + rate limit por IP
	//   reset-password-with-token  token de convite de uso único
	//   heartbeat                  X-Agent-Key + rate limit por IP
	//   commands/poll|respond      X-Agent-Key
	//   self-heal-event            X-Agent-Key (+ confere empresa da máquina)
	//   cron/*                     CRON_SECRET, fail-closed
	//   ws/terminal*, ws/system-graph  token no subprotocolo (WS não aceita header Authorization)
	r.Post("/api/functions/reset-password-with-token", resetPasswordWithToken)
	r.Get("/api/auth/machine-login", machineLogin)

	r.Post("/api/monitoring/machines/heartbeat", monitoringHeartbeat)
	r.Get("/api/monitoring/commands/poll", monitoringPollCommands)
	r.Post("/api/monitoring/commands/respond", monitoringCommandResponse)
	r.Post("/api/monitoring/self-heal-event", monitoringSelfHealEvent)

	r.Get("/api/monitoring/cron/mark-offline", cronMarkOffline)
	r.Get("/api/monitoring/cron/probe-network-links", cronProbeNetworkLinks)

	r.Get("/api/ws/terminal", WsTerminalBrowserHandler)
	r.Get("/api/ws/terminal/agent", WsTerminalAgentHandler)
	r.Get("/api/ws/system-graph", WsSystemGraphHandler)

	// ── Rotas de usuário: escopo de empresa OBRIGATÓRIO ───────────────────────
	//
	// Tudo que é autenticado por JWT de usuário passa por RequireCompanyScope.
	// O escopo é resolvido uma única vez aqui e lido do contexto pelos handlers
	// (ver requireAuth/escopoDoUsuario) — deixou de ser responsabilidade de
	// cada handler lembrar de fazer a checagem.
	r.Group(func(r chi.Router) {
		r.Use(RequireCompanyScope)

		// /functions/*
		r.Post("/api/functions/admin-update-user", adminUpdateUser)
		r.Post("/api/functions/delete-user-admin", deleteUserAdmin)
		r.Post("/api/functions/create-user-credentials", createUserCredentials)
		r.Post("/api/functions/check-rate-limit", checkRateLimit)
		r.Post("/api/functions/send-password-changed-alert", sendPasswordChangedAlert)

		// /api/tickets/*
		r.Get("/api/tickets/resolve/{id}", ticketResolveHandler)

		// /api/monitoring/*
		r.Get("/api/monitoring/dashboard", monitoringDashboard)
		r.Get("/api/monitoring/groups", monitoringListGroups)
		r.Get("/api/monitoring/groups/{id}/machines", monitoringGroupMachines)
		r.Get("/api/monitoring/machines/{id}", monitoringMachineDetail)
		r.Get("/api/monitoring/machines/{id}/metrics", monitoringMachineMetrics)
		r.Get("/api/monitoring/machines/{id}/alerts", monitoringMachineAlerts)
		r.Post("/api/monitoring/machines/{id}/commands", monitoringCreateCommand)
		r.Get("/api/monitoring/machines/{id}/commands", monitoringGetMachineCommands)
		r.Get("/api/monitoring/alerts/critical", monitoringCriticalAlerts)

		// Network Links Monitoring
		r.Get("/api/monitoring/network/links", monitoringListNetworkLinks)
		r.Post("/api/monitoring/network/links", monitoringCreateNetworkLink)
		r.Delete("/api/monitoring/network/links/{id}", monitoringDeleteNetworkLink)
		r.Get("/api/monitoring/network-links", monitoringListNetworkLinks)
		r.Post("/api/monitoring/network-links", monitoringCreateNetworkLink)
		r.Delete("/api/monitoring/network-links/{id}", monitoringDeleteNetworkLink)

		// Web Monitoring (UptimeRobot)
		r.Post("/api/monitoring/web/endpoints", monitoringCreateWebEndpoint)
		r.Get("/api/monitoring/web/endpoints", monitoringListWebEndpoints)
		r.Delete("/api/monitoring/web/endpoints/{id}", monitoringDeleteWebEndpoint)

		// Management
		r.Post("/api/monitoring/machines/{id}/update", monitoringUpdateMachine)
		r.Post("/api/monitoring/groups", monitoringCreateGroup)
		r.Post("/api/monitoring/groups/{id}/update", monitoringUpdateGroup)
		r.Delete("/api/monitoring/groups/{id}", monitoringDeleteGroup)
	})

	return r
}

// proxiesConfiaveis devolve quantos proxies existem entre a internet e esta
// função. Na Vercel é 1. Ajustável por TRUSTED_PROXY_COUNT.
func proxiesConfiaveis() int {
	if v := os.Getenv("TRUSTED_PROXY_COUNT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 {
			return n
		}
		log.Printf("[ALERTA] TRUSTED_PROXY_COUNT=%q inválido — usando 1", v)
	}
	return 1
}

// origensPermitidas lista as origens que podem fazer requisição cross-origin.
//
// Antes o middleware refletia QUALQUER Origin recebida junto de
// Allow-Credentials: true. Hoje isso não é explorável — a autenticação é só via
// header Bearer, sem cookie e sem credentials:'include', e foi por isso que o
// pentest registrou como recomendação e não como vulnerabilidade. Mas a
// combinação "reflete tudo + permite credenciais" vira falha grave no dia em
// que qualquer auth por cookie entrar no sistema, então a allowlist fecha a
// porta antes disso.
//
// Origens extras (previews da Vercel, domínio próprio) via CORS_ORIGINS,
// separadas por vírgula.
func origensPermitidas() map[string]bool {
	lista := map[string]bool{
		"https://orion.bysam.dev": true,
		"http://localhost:8080":   true, // vite dev server (vite.config.ts)
		"http://127.0.0.1:8080":   true,
	}
	for _, o := range strings.Split(os.Getenv("CORS_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			lista[o] = true
		}
	}
	return lista
}

var corsAllowlist = origensPermitidas()

// corsMiddleware libera CORS apenas para origens da allowlist.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Só ecoa a Origin (e só concede credenciais) se ela estiver na lista.
		// Requisição sem Origin — o agente Windows, curl, cron da Vercel — não
		// é cross-origin e não precisa de header nenhum para funcionar.
		if origin != "" && corsAllowlist[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin") // resposta varia por origem: não cachear cruzado
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Key")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Pontos de injeção para teste — permitem exercitar RequireCompanyScope sem
// Supabase nem banco.
var (
	autenticar = func(r *http.Request) (*lib.AuthUser, error) { return lib.RequireAuth(r, sb) }
	resolverEscopo = func(r *http.Request, userID string) (lib.UserScope, error) {
		return db.UserScopeByID(r.Context(), userID)
	}
)

// requireAuth devolve o usuário autenticado da requisição.
//
// Quando RequireCompanyScope já rodou (todas as rotas de usuário), o usuário
// vem do contexto e NÃO há segunda ida ao Supabase — é isso que torna o
// middleware obrigatório sem dobrar a latência de cada handler. O caminho de
// validação direta continua para rotas fora do grupo escopado.
func requireAuth(r *http.Request) (*lib.AuthUser, error) {
	if user, ok := lib.UserFromContext(r.Context()); ok {
		return user, nil
	}
	return autenticar(r)
}

// RequireCompanyScope autentica a requisição, resolve a empresa/papel do
// usuário e injeta os dois no contexto.
//
// Falha FECHADO em todos os caminhos: token ausente/inválido → 401; escopo
// irresolvível → 500; usuário sem empresa e sem visão global → 403. Nenhuma
// requisição chega ao handler sem escopo definido.
//
// Aplicado em grupo no buildRouter, não handler a handler: o modelo anterior
// dependia de cada handler lembrar de filtrar por company_id, e bastava um
// esquecimento para vazar dados entre empresas.
func RequireCompanyScope(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := autenticar(r)
		if err != nil {
			lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
			return
		}

		scope, err := resolverEscopo(r, user.ID)
		if err != nil {
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao resolver escopo"})
			return
		}

		if !scope.Global() && scope.CompanyID == nil {
			lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Usuário sem empresa vinculada ao perfil"})
			return
		}

		ctx := lib.ContextWithUserAndScope(r.Context(), user, scope)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireAdminOrDeveloper checks that the user has admin or developer role.
func requireAdminOrDeveloper(r *http.Request, userID string) (string, error) {
	role, err := db.RoleByUserID(r.Context(), userID)
	if err != nil {
		return "", err
	}
	if role != "admin" && role != "developer" {
		return role, http.ErrNoCookie // any non-nil error works as forbidden
	}
	return role, nil
}

// autorizarCron valida o bearer dos endpoints de cron e devolve false quando a
// requisição já foi respondida (chamador deve apenas retornar).
//
// Falha FECHADO: antes, a checagem só rodava `if cronSecret != ""` — numa
// implantação sem a variável configurada, qualquer um na internet chamava os
// endpoints e mutava estado (Strix vuln-0011). Agora a ausência de CRON_SECRET
// é tratada como erro de configuração, não como permissão implícita.
//
// ATENÇÃO OPERACIONAL: se CRON_SECRET não estiver definida no projeto da
// Vercel, os crons do vercel.json passam a responder 503 e param de rodar —
// máquinas deixam de ser marcadas offline. Conferir a variável antes do deploy.
func autorizarCron(w http.ResponseWriter, r *http.Request) bool {
	cronSecret := os.Getenv("CRON_SECRET")
	if cronSecret == "" {
		log.Printf("[ALERTA] cron chamado mas CRON_SECRET não está configurada — recusando por segurança (%s)", r.URL.Path)
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": "CRON_SECRET não configurada no ambiente — endpoint desabilitado",
		})
		return false
	}
	if r.Header.Get("Authorization") != "Bearer "+cronSecret {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
		return false
	}
	return true
}

// cronMarkOffline is called by Vercel Cron every 5 minutes.
// Vercel sets Authorization: Bearer <CRON_SECRET>.
func cronMarkOffline(w http.ResponseWriter, r *http.Request) {
	if !autorizarCron(w, r) {
		return
	}

	if db == nil {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "sem conexão com banco"})
		return
	}

	n, err := db.MarkOfflineMachines(r.Context())
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"marked_offline": n})
}

// maxBodySizeMiddleware limits incoming request body to prevent memory exhaustion DoS (10MB max).
func maxBodySizeMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
		}
		next.ServeHTTP(w, r)
	})
}

