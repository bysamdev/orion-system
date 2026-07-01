package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
)

func main() {
	data, err := os.ReadFile(".env.local")
	if err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "DATABASE_URL=") {
				os.Setenv("DATABASE_URL", strings.TrimPrefix(line, "DATABASE_URL="))
			}
		}
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("DATABASE_URL is required")
		os.Exit(1)
	}

	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	query := `
	CREATE TABLE IF NOT EXISTS monitored_endpoints (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id uuid REFERENCES companies(id),
		name text NOT NULL,
		url_or_ip text NOT NULL,
		uptimerobot_monitor_id text,
		status text DEFAULT 'pending',
		last_check timestamptz,
		created_at timestamptz DEFAULT now()
	);

	ALTER TABLE monitored_endpoints ENABLE ROW LEVEL SECURITY;

	DROP POLICY IF EXISTS "Users can view their company endpoints" ON monitored_endpoints;
	CREATE POLICY "Users can view their company endpoints"
		ON monitored_endpoints FOR SELECT
		USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

	DROP POLICY IF EXISTS "Users can insert their company endpoints" ON monitored_endpoints;
	CREATE POLICY "Users can insert their company endpoints"
		ON monitored_endpoints FOR INSERT
		WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

	DROP POLICY IF EXISTS "Users can update their company endpoints" ON monitored_endpoints;
	CREATE POLICY "Users can update their company endpoints"
		ON monitored_endpoints FOR UPDATE
		USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

	DROP POLICY IF EXISTS "Users can delete their company endpoints" ON monitored_endpoints;
	CREATE POLICY "Users can delete their company endpoints"
		ON monitored_endpoints FOR DELETE
		USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
	`

	_, err = conn.Exec(context.Background(), query)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Migration successful!")
}
