-- Migration for Smart Management Features
-- Adds tables and columns for routing, SLA pause, auto-escalation, and resolution checklists

-- 1. Modify Tickets Table for SLA Pauses
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_accumulated_pause_minutes INTEGER DEFAULT 0;

-- 2. Routing Rules Table
CREATE TABLE IF NOT EXISTS public.routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition_category TEXT,
    condition_priority TEXT,
    condition_company_id UUID REFERENCES public.companies(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('assign_tech', 'round_robin', 'notify_all', 'escalate_manager')),
    action_target_user_id UUID REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Routing Rules
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routing rules of their company"
    ON public.routing_rules FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage routing rules"
    ON public.routing_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'developer')
        )
    );

-- 3. Escalation Settings Table
CREATE TABLE IF NOT EXISTS public.escalation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
    sla_warning_pct INTEGER DEFAULT 80,
    sla_critical_pct INTEGER DEFAULT 100,
    manager_escalation_hours INTEGER DEFAULT 2,
    critical_escalation_hours INTEGER DEFAULT 24,
    waiting_customer_timeout_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Escalation Settings
ALTER TABLE public.escalation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view escalation settings of their company"
    ON public.escalation_settings FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage escalation settings"
    ON public.escalation_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'developer')
        )
    );

-- 4. Resolution Checklists Table
CREATE TABLE IF NOT EXISTS public.resolution_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings (the checklist items)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, category)
);

-- RLS for Resolution Checklists
ALTER TABLE public.resolution_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view resolution checklists of their company"
    ON public.resolution_checklists FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage resolution checklists"
    ON public.resolution_checklists FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'developer')
        )
    );

-- 5. RPC Function for Technician Workload
-- Returns aggregated workload data for active technicians
CREATE OR REPLACE FUNCTION get_technician_workload(p_company_id UUID)
RETURNS TABLE (
    technician_id UUID,
    technician_name TEXT,
    open_tickets BIGINT,
    sla_at_risk_tickets BIGINT,
    resolved_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as technician_id,
        p.full_name as technician_name,
        COALESCE(SUM(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END), 0) as open_tickets,
        COALESCE(SUM(CASE 
            WHEN t.status NOT IN ('resolved', 'closed') AND 
                 (EXTRACT(EPOCH FROM (now() - t.created_at)) / 3600 >= 
                  CASE t.priority 
                    WHEN 'urgent' THEN 4 
                    WHEN 'high' THEN 24 
                    WHEN 'medium' THEN 48 
                    WHEN 'low' THEN 72 
                    ELSE 48 END * 0.8) -- 80% of SLA logic
            THEN 1 ELSE 0 END), 0) as sla_at_risk_tickets,
        COALESCE(SUM(CASE WHEN t.status = 'resolved' AND DATE(t.updated_at) = CURRENT_DATE THEN 1 ELSE 0 END), 0) as resolved_today
    FROM 
        public.profiles p
    LEFT JOIN 
        public.tickets t ON t.assigned_to_user_id = p.id AND t.company_id = p_company_id
    WHERE 
        p.role IN ('technician', 'admin', 'developer')
        AND p.company_id = p_company_id
    GROUP BY 
        p.id, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
