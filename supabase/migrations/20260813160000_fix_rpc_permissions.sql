-- =================================================================================
-- Migration: Fix RPC Permissions
-- Description: Recreates missing get_technician_workload function and grants 
--              execute permissions to authenticated users.
-- =================================================================================

-- Recreate missing function (was present in local migrations but missing remotely)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_technician_workload TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_company_user TO authenticated;
