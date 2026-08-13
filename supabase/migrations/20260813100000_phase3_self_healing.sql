CREATE TABLE IF NOT EXISTS public.rmm_remediation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    condition_json JSONB,
    action_type TEXT NOT NULL,
    action_payload JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rmm_remediation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    rule_id UUID REFERENCES public.rmm_remediation_rules(id),
    status TEXT NOT NULL,
    output TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remediation_rules_alert_type ON public.rmm_remediation_rules (alert_type);
CREATE INDEX IF NOT EXISTS idx_remediation_logs_agent_id ON public.rmm_remediation_logs (agent_id);

-- RLS
ALTER TABLE public.rmm_remediation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rmm_remediation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on rmm_remediation_rules" ON public.rmm_remediation_rules FOR SELECT USING (true);
CREATE POLICY "Allow all on rmm_remediation_rules for authenticated users" ON public.rmm_remediation_rules FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert on rmm_remediation_logs" ON public.rmm_remediation_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select on rmm_remediation_logs for authenticated users" ON public.rmm_remediation_logs FOR SELECT USING (auth.role() = 'authenticated');
