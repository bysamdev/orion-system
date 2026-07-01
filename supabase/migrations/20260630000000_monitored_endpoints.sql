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
