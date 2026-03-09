package app

import (
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

	return r
}

