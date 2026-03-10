package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Addr string

	AllowedOrigins []string

	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string

	DatabaseURL string

	ResendAPIKey string
	ResendFrom   string

	LoginURL  string
	InviteURL string

	// AgentKey é a chave secreta que os agentes de monitoramento devem enviar
	// no header X-Agent-Key ao chamar POST /api/monitoring/machines/heartbeat.
	AgentKey string
}

func FromEnv() (Config, error) {
	cfg := Config{
		Addr: os.Getenv("ADDR"),
	}
	if cfg.Addr == "" {
		cfg.Addr = ":8080"
	}

	cfg.AllowedOrigins = parseCSV(os.Getenv("ALLOWED_ORIGINS"))
	if len(cfg.AllowedOrigins) == 0 {
		cfg.AllowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	}

	cfg.SupabaseURL = strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	cfg.SupabaseAnonKey = os.Getenv("SUPABASE_ANON_KEY")
	cfg.SupabaseServiceRoleKey = os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	cfg.DatabaseURL = os.Getenv("DATABASE_URL")

	cfg.ResendAPIKey = os.Getenv("RESEND_API_KEY")
	cfg.ResendFrom = os.Getenv("RESEND_FROM")
	if cfg.ResendFrom == "" {
		cfg.ResendFrom = "Orion System <no-reply@orion.local>"
	}

	cfg.LoginURL = os.Getenv("LOGIN_URL")
	if cfg.LoginURL == "" {
		cfg.LoginURL = "http://localhost:5173/auth"
	}

	cfg.InviteURL = os.Getenv("INVITE_URL")
	if cfg.InviteURL == "" {
		// seu frontend usa HashRouter; manter compatível com o link atual
		cfg.InviteURL = "http://localhost:5173/#/definir-senha"
	}

	cfg.AgentKey = os.Getenv("AGENT_KEY")

	if cfg.SupabaseURL == "" || cfg.SupabaseAnonKey == "" || cfg.SupabaseServiceRoleKey == "" {
		return Config{}, errors.New("env obrigatórias: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY")
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("env obrigatória: DATABASE_URL")
	}

	return cfg, nil
}

func parseCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, p)
	}
	return out
}

