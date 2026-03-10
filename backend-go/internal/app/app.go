package app

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"orion-system-backend/internal/config"
	"orion-system-backend/internal/db"
	"orion-system-backend/internal/email"
	"orion-system-backend/internal/handlers"
	"orion-system-backend/internal/supabase"
)

type App struct {
	cfg    config.Config
	db     *db.DB
	sb     *supabase.Client
	mailer *email.Resend
}

func New(cfg config.Config) (*App, error) {
	d, err := db.New(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	sb := supabase.New(cfg.SupabaseURL, cfg.SupabaseAnonKey, cfg.SupabaseServiceRoleKey)

	var mailer *email.Resend
	if cfg.ResendAPIKey != "" {
		mailer = email.NewResend(cfg.ResendAPIKey, cfg.ResendFrom)
	}

	return &App{
		cfg:    cfg,
		db:     d,
		sb:     sb,
		mailer: mailer,
	}, nil
}

func (a *App) Close() {
	if a.db != nil {
		a.db.Close()
	}
}

func (a *App) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Use(handlers.CORS(a.cfg.AllowedOrigins))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	h := handlers.New(handlers.Deps{
		Cfg:    a.cfg,
		DB:     a.db,
		SB:     a.sb,
		Mailer: a.mailer,
	})

	r.Route("/functions", func(r chi.Router) {
		r.Post("/admin-update-user", h.AdminUpdateUser)
		r.Post("/delete-user-admin", h.DeleteUserAdmin)
		r.Post("/create-user-credentials", h.CreateUserCredentials)
		r.Post("/check-rate-limit", h.CheckRateLimit)
		r.Post("/send-password-changed-alert", h.SendPasswordChangedAlert)
		r.Post("/reset-password-with-token", h.ResetPasswordWithToken)
	})

	// ── Monitoring ──────────────────────────────────────────────────────────
	r.Route("/api/monitoring", func(r chi.Router) {
		// Dashboard geral
		r.Get("/dashboard", h.MonitoringDashboard)

		// Grupos de máquinas
		r.Get("/groups", h.MonitoringListGroups)
		r.Get("/groups/{id}/machines", h.MonitoringGroupMachines)

		// Máquinas
		r.Get("/machines/{id}", h.MonitoringMachineDetail)
		r.Get("/machines/{id}/metrics", h.MonitoringMachineMetrics)
		r.Get("/machines/{id}/alerts", h.MonitoringMachineAlerts)

		// Heartbeat do agente (sem Bearer — usa X-Agent-Key)
		r.Post("/machines/heartbeat", h.MonitoringHeartbeat)
	})

	return r
}

// StartMonitoringCron inicia um goroutine que marca máquinas como offline
// a cada minuto, quando last_seen > 5 minutos atrás.
// O goroutine para quando ctx é cancelado.
func (a *App) StartMonitoringCron(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		log.Println("monitoring cron: iniciado (tick a cada 1 minuto)")
		for {
			select {
			case <-ctx.Done():
				log.Println("monitoring cron: encerrado")
				return
			case <-ticker.C:
				n, err := a.db.MarkOfflineMachines(ctx)
				if err != nil {
					log.Printf("monitoring cron: erro ao marcar offline: %v", err)
				} else if n > 0 {
					log.Printf("monitoring cron: %d máquina(s) marcada(s) como offline", n)
				}
			}
		}
	}()
}


