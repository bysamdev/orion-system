package handler

// [...path].go — Vercel catch-all Go serverless function.
// This file contains the entry point and global initialization.
// All routes are handled by the chi router built in init().

import (
	"net/http"
	"os"
	"sync"

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
	})
}

// Handler is the Vercel Go serverless function entry point.
func Handler(w http.ResponseWriter, r *http.Request) {
	router.ServeHTTP(w, r)
}

// buildRouter wires all routes.
func buildRouter() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// ── /functions/* ──────────────────────────────────────────────────────────
	r.Post("/api/functions/admin-update-user", adminUpdateUser)
	r.Post("/api/functions/delete-user-admin", deleteUserAdmin)
	r.Post("/api/functions/create-user-credentials", createUserCredentials)
	r.Post("/api/functions/check-rate-limit", checkRateLimit)
	r.Post("/api/functions/send-password-changed-alert", sendPasswordChangedAlert)
	r.Post("/api/functions/reset-password-with-token", resetPasswordWithToken)

	// ── /api/monitoring/* ─────────────────────────────────────────────────────
	r.Get("/api/monitoring/dashboard", monitoringDashboard)
	r.Get("/api/monitoring/groups", monitoringListGroups)
	r.Get("/api/monitoring/groups/{id}/machines", monitoringGroupMachines)
	r.Post("/api/monitoring/machines/heartbeat", monitoringHeartbeat)
	r.Get("/api/monitoring/machines/{id}", monitoringMachineDetail)
	r.Get("/api/monitoring/machines/{id}/metrics", monitoringMachineMetrics)
	r.Get("/api/monitoring/machines/{id}/alerts", monitoringMachineAlerts)
	r.Post("/api/monitoring/machines/{id}/commands", monitoringCreateCommand)
	r.Get("/api/monitoring/machines/{id}/commands", monitoringGetMachineCommands)
	r.Get("/api/monitoring/commands/poll", monitoringPollCommands)
	r.Post("/api/monitoring/commands/respond", monitoringCommandResponse)
	r.Get("/api/monitoring/cron/mark-offline", cronMarkOffline)

	return r
}

// corsMiddleware adds permissive CORS headers.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Key")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireAuth validates Bearer token and returns the user.
func requireAuth(r *http.Request) (*lib.AuthUser, error) {
	return lib.RequireAuth(r, sb)
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

// cronMarkOffline is called by Vercel Cron every 5 minutes.
// Vercel sets Authorization: Bearer <CRON_SECRET>.
func cronMarkOffline(w http.ResponseWriter, r *http.Request) {
	cronSecret := os.Getenv("CRON_SECRET")
	if cronSecret != "" {
		got := r.Header.Get("Authorization")
		if got != "Bearer "+cronSecret {
			lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
			return
		}
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
