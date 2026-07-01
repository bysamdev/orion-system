package lib

import "os"

// Config holds all server-side environment variables.
type Config struct {
	DatabaseURL        string
	SupabaseURL        string
	SupabaseAnonKey    string
	SupabaseServiceKey string
	AgentKey           string
	UptimeRobotKey     string
	ResendAPIKey       string
	ResendFrom         string
	LoginURL           string
	InviteURL          string
}

func LoadConfig() Config {
	// Try common Supabase/Vercel naming conventions
	supabaseURL := envOr("SUPABASE_URL", envOr("NEXT_PUBLIC_SUPABASE_URL", ""))
	supabaseAnonKey := envOr("SUPABASE_ANON_KEY", envOr("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))
	supabaseServiceKey := envOr("SUPABASE_SERVICE_ROLE_KEY", envOr("SUPABASE_SERVICE_KEY", ""))

	return Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SupabaseURL:        supabaseURL,
		SupabaseAnonKey:    supabaseAnonKey,
		SupabaseServiceKey: supabaseServiceKey,
		AgentKey:           os.Getenv("AGENT_KEY"),
		UptimeRobotKey:     os.Getenv("UPTIMEROBOT_API_KEY"),
		ResendAPIKey:       os.Getenv("RESEND_API_KEY"),
		ResendFrom:         envOr("RESEND_FROM", "Orion System <no-reply@orion.local>"),
		LoginURL:           envOr("LOGIN_URL", "https://orion.bysam.dev/auth"),
		InviteURL:          envOr("INVITE_URL", "https://orion.bysam.dev/definir-senha"),
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
