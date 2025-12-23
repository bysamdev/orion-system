-- Função RPC para calcular estatísticas do dashboard do Admin
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  user_company_id uuid;
  is_master boolean;
  user_role text;
BEGIN
  -- Obter company_id e verificar se é master
  SELECT company_id INTO user_company_id FROM profiles WHERE id = auth.uid();
  SELECT is_master_company_user(auth.uid()) INTO is_master;
  SELECT role INTO user_role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Verificar permissão (apenas admin, technician ou developer)
  IF user_role NOT IN ('admin', 'technician', 'developer') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  WITH filtered_tickets AS (
    SELECT * FROM tickets t
    WHERE 
      -- Developers e master admins veem tudo
      (user_role = 'developer' OR is_master)
      OR
      -- Outros veem apenas da própria empresa
      (t.company_id = user_company_id)
  ),
  
  -- KPIs principais
  kpis AS (
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('open', 'in-progress', 'reopened')) as open_tickets,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at::date = CURRENT_DATE) as resolved_today,
      ROUND(
        EXTRACT(EPOCH FROM AVG(resolved_at - created_at) FILTER (WHERE resolved_at IS NOT NULL)) / 3600,
        1
      ) as avg_resolution_hours,
      COUNT(*) FILTER (WHERE sla_status = 'breached' AND status NOT IN ('resolved', 'closed')) as sla_violated
    FROM filtered_tickets
  ),
  
  -- Chamados por departamento (top 5)
  by_department AS (
    SELECT 
      COALESCE(department, 'Sem Departamento') as name,
      COUNT(*) as value
    FROM filtered_tickets
    WHERE status NOT IN ('closed')
    GROUP BY department
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ),
  
  -- Chamados por status
  by_status AS (
    SELECT 
      CASE status
        WHEN 'open' THEN 'Aberto'
        WHEN 'in-progress' THEN 'Em Progresso'
        WHEN 'resolved' THEN 'Resolvido'
        WHEN 'closed' THEN 'Fechado'
        WHEN 'reopened' THEN 'Reaberto'
        ELSE status
      END as name,
      COUNT(*) as value
    FROM filtered_tickets
    GROUP BY status
  ),
  
  -- Volume dos últimos 7 dias
  daily_volume AS (
    SELECT 
      TO_CHAR(d.date, 'DD/MM') as date,
      COALESCE(opened.count, 0) as opened,
      COALESCE(resolved.count, 0) as resolved
    FROM (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date as date
    ) d
    LEFT JOIN (
      SELECT created_at::date as day, COUNT(*) as count
      FROM filtered_tickets
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY created_at::date
    ) opened ON d.date = opened.day
    LEFT JOIN (
      SELECT resolved_at::date as day, COUNT(*) as count
      FROM filtered_tickets
      WHERE resolved_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY resolved_at::date
    ) resolved ON d.date = resolved.day
    ORDER BY d.date
  )
  
  SELECT json_build_object(
    'kpis', (SELECT row_to_json(kpis) FROM kpis),
    'by_department', (SELECT COALESCE(json_agg(row_to_json(by_department)), '[]'::json) FROM by_department),
    'by_status', (SELECT COALESCE(json_agg(row_to_json(by_status)), '[]'::json) FROM by_status),
    'daily_volume', (SELECT COALESCE(json_agg(row_to_json(daily_volume)), '[]'::json) FROM daily_volume)
  ) INTO result;
  
  RETURN result;
END;
$$;