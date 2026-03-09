
-- Atualizar track_ticket_response_times para incluir novos status
CREATE OR REPLACE FUNCTION public.track_ticket_response_times()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Registrar first_response_at quando ticket passa para 'in-progress'
  IF OLD.status IN ('open', 'reopened') AND NEW.status = 'in-progress' THEN
    IF OLD.first_response_at IS NULL THEN
      NEW.first_response_at := NOW();
    END IF;
  END IF;
  
  -- Registrar resolved_at quando ticket é resolvido
  IF OLD.status NOT IN ('resolved', 'closed') AND NEW.status IN ('resolved', 'closed') THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- Limpar resolved_at se ticket for reaberto
  IF OLD.status IN ('resolved', 'closed') AND NEW.status = 'reopened' THEN
    NEW.resolved_at := NULL;
  END IF;
  
  -- Pausar contagem SLA quando aguardando cliente/terceiro
  -- (SLA continua com base no sla_due_date original, mas marcamos o status)
  
  RETURN NEW;
END;
$function$;

-- Atualizar update_all_tickets_sla_status para considerar novos status
CREATE OR REPLACE FUNCTION public.update_all_tickets_sla_status()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE tickets
  SET sla_status = CASE
    WHEN NOW() > sla_due_date THEN 'breached'
    WHEN NOW() > (sla_due_date - INTERVAL '4 hours') THEN 'attention'
    ELSE 'ok'
  END
  WHERE status NOT IN ('resolved', 'closed', 'cancelled')
    AND sla_due_date IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

-- Atualizar auto_close_resolved_tickets
CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  closed_count INTEGER;
BEGIN
  UPDATE tickets
  SET status = 'closed', updated_at = now()
  WHERE status = 'resolved'
    AND resolved_at < now() - INTERVAL '48 hours';
  
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$function$;

-- Atualizar get_dashboard_stats para incluir novos status
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  user_company_id uuid;
  is_master boolean;
  user_role text;
BEGIN
  SELECT company_id INTO user_company_id FROM profiles WHERE id = auth.uid();
  SELECT is_master_company_user(auth.uid()) INTO is_master;
  SELECT role INTO user_role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  IF user_role NOT IN ('admin', 'technician', 'developer') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  WITH filtered_tickets AS (
    SELECT * FROM tickets t
    WHERE 
      (user_role = 'developer' OR is_master)
      OR
      (t.company_id = user_company_id)
  ),
  
  kpis AS (
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party')) as open_tickets,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at::date = CURRENT_DATE) as resolved_today,
      ROUND(
        EXTRACT(EPOCH FROM AVG(resolved_at - created_at) FILTER (WHERE resolved_at IS NOT NULL)) / 3600,
        1
      ) as avg_resolution_hours,
      COUNT(*) FILTER (WHERE sla_status = 'breached' AND status NOT IN ('resolved', 'closed', 'cancelled')) as sla_violated
    FROM filtered_tickets
  ),
  
  by_department AS (
    SELECT 
      COALESCE(department, 'Sem Departamento') as name,
      COUNT(*) as value
    FROM filtered_tickets
    WHERE status NOT IN ('closed', 'cancelled')
    GROUP BY department
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ),
  
  by_status AS (
    SELECT 
      CASE status
        WHEN 'open' THEN 'Aberto'
        WHEN 'in-progress' THEN 'Em Progresso'
        WHEN 'resolved' THEN 'Resolvido'
        WHEN 'closed' THEN 'Fechado'
        WHEN 'reopened' THEN 'Reaberto'
        WHEN 'awaiting-customer' THEN 'Aguard. Cliente'
        WHEN 'awaiting-third-party' THEN 'Aguard. Terceiro'
        WHEN 'cancelled' THEN 'Cancelado'
        ELSE status
      END as name,
      COUNT(*) as value
    FROM filtered_tickets
    GROUP BY status
  ),
  
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
$function$;
