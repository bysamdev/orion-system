-- Fase 7 da auditoria (lint 0029 do advisor): revisão das 19 funções
-- SECURITY DEFINER chamáveis por usuário logado. 16 já conferem quem chama
-- (ou só devolvem dados do próprio usuário, ou são auxiliares da RLS).
-- Três precisavam de ajuste:
--
-- get_dashboard_stats / get_company_plan_usage: liam o papel com LIMIT 1 sem
-- ordem e barravam com "papel NOT IN (...)". Sem linha em user_roles (é
-- assim que UpdateUserRole grava o cliente desde a correção do ORN-BUG-09) o
-- papel vem NULL, a comparação dá NULL e o IF não barra: o cliente veria os
-- números da empresa. E quem tem dois papéis caía num qualquer. Agora pega o
-- papel mais alto e barra também o NULL.
--
-- get_technician_workload: qualquer pessoa da empresa, inclusive cliente, via
-- a carga de cada técnico. Agora exige admin ou técnico da empresa (ou equipe
-- global).

CREATE OR REPLACE FUNCTION public.get_technician_workload(p_company_id uuid)
RETURNS TABLE(technician_id uuid, technician_name text, open_tickets bigint, sla_at_risk_tickets bigint, resolved_today bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_global boolean := public.is_master_company_user(v_uid);
BEGIN
    IF NOT (
        v_global
        OR (
            p_company_id = public.get_user_company_id(v_uid)
            AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'technician'::app_role))
        )
    ) THEN
        RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        COUNT(t.id) FILTER (WHERE t.status IN ('open', 'reopened', 'in-progress', 'awaiting-customer', 'awaiting-third-party')),
        COUNT(t.id) FILTER (WHERE t.status IN ('open', 'reopened', 'in-progress')
                              AND t.sla_status IN ('attention', 'breached')),
        COUNT(t.id) FILTER (WHERE t.resolved_at >= date_trunc('day', now()))
    FROM public.profiles p
    LEFT JOIN public.tickets t
           ON t.assigned_to_user_id = p.id
          AND (v_global OR t.company_id = p_company_id)
    WHERE (v_global OR p.company_id = p_company_id)
      AND EXISTS (
            SELECT 1 FROM public.user_roles ur
             WHERE ur.user_id = p.id
               AND ur.role IN ('technician', 'admin', 'developer')
          )
    GROUP BY p.id, p.full_name
    ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_plan_usage()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  result json;
  user_company_id uuid;
  user_role text;
BEGIN
  SELECT company_id INTO user_company_id FROM profiles WHERE id = auth.uid();

  SELECT role::text INTO user_role FROM user_roles WHERE user_id = auth.uid()
   ORDER BY CASE role::text WHEN 'developer' THEN 1 WHEN 'admin' THEN 2 WHEN 'technician' THEN 3 ELSE 4 END
   LIMIT 1;

  -- Apenas admin, technician ou developer podem ver essa informação.
  IF user_role IS NULL OR user_role NOT IN ('admin', 'technician', 'developer') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT json_build_object(
    'plan_name', COALESCE(p.name, 'Starter'),
    'max_users', COALESCE(p.max_users, 20),
    'current_users', (SELECT COUNT(*) FROM profiles WHERE company_id = user_company_id),
    'company_id', user_company_id
  ) INTO result
  FROM companies c
  LEFT JOIN plans p ON p.id = c.current_plan_id
  WHERE c.id = user_company_id;

  RETURN COALESCE(result, json_build_object(
    'plan_name', 'Starter',
    'max_users', 20,
    'current_users', 0,
    'company_id', user_company_id
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  result json;
  user_company_id uuid;
  is_master boolean;
  user_role text;
BEGIN
  SELECT company_id INTO user_company_id FROM profiles WHERE id = auth.uid();
  SELECT is_master_company_user(auth.uid()) INTO is_master;
  SELECT role::text INTO user_role FROM user_roles WHERE user_id = auth.uid()
   ORDER BY CASE role::text WHEN 'developer' THEN 1 WHEN 'admin' THEN 2 WHEN 'technician' THEN 3 ELSE 4 END
   LIMIT 1;

  IF user_role IS NULL OR user_role NOT IN ('admin', 'technician', 'developer') THEN
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
$$;
