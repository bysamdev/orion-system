package lib

import "os"

// Config holds all server-side environment variables.
type Config struct {
	DatabaseURL        string
	SupabaseURL        string
	SupabaseAnonKey    string
	SupabaseServiceKey string
	AgentKey           string
	ResendAPIKey       string
	ResendFrom         string
	LoginURL           string
	InviteURL          string
}

func LoadConfig() Config {
	return Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SupabaseURL:        envOr("SUPABASE_URL", ""),
		SupabaseAnonKey:    os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		AgentKey:           os.Getenv("AGENT_KEY"),
		ResendAPIKey:       os.Getenv("RESEND_API_KEY"),
		ResendFrom:         envOr("RESEND_FROM", "Orion System <no-reply@orion.local>"),
		LoginURL:           envOr("LOGIN_URL", "https://orion.vercel.app/auth"),
		InviteURL:          envOr("INVITE_URL", "https://orion.vercel.app/#/definir-senha"),
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
