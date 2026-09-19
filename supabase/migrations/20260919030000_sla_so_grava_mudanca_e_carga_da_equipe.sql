-- =============================================================================
-- Cron de SLA só grava o que muda + carga da equipe volta a funcionar
-- =============================================================================
--
-- 1. update_all_tickets_sla_status (job sla-status-recalc, a cada 15 min)
--    regravava sla_status em TODO chamado ativo, mesmo sem mudança. Cada
--    execução trocava o updated_at (gatilho) e gerava uma linha de auditoria
--    por chamado: 384 linhas/dia com 4 chamados ativos. Pior: os comandos de
--    chamado usam updated_at como trava de versão (p_expected_updated_at), então
--    o técnico que abriu a tela antes do cron passar recebia "o chamado foi
--    modificado por outro técnico" sem ninguém ter mexido. Agora só grava
--    quando o valor calculado é diferente do gravado.
--
-- 2. get_technician_workload filtrava por profiles.role, coluna que não
--    existe (as funções ficam em user_roles). Toda chamada falhava com 400 e o
--    bloco "Carga de trabalho da equipe" nunca aparecia. Também contava
--    cancelados como "em aberto" e "resolvidos hoje" pelo updated_at, que o
--    próprio cron acima mexia. Agora: equipe via user_roles, abertos = status
--    ativos, resolvidos hoje = resolved_at de hoje. Para a equipe da
--    empresa-mãe a carga é global, porque ela atende todas as empresas.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_all_tickets_sla_status()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  WITH calculado AS (
    SELECT id,
           CASE
             WHEN NOW() > sla_due_date THEN 'breached'
             WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 10
                  OR EXTRACT(EPOCH FROM (sla_due_date - NOW())) <= 7200 THEN 'attention'
             WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 25 THEN 'warning'
             ELSE 'ok'
           END AS novo
      FROM tickets
     WHERE status NOT IN ('resolved', 'closed', 'cancelled', 'awaiting-customer', 'awaiting-third-party')
       AND sla_due_date IS NOT NULL
       AND sla_due_date > created_at
  )
  UPDATE tickets t
     SET sla_status = c.novo
    FROM calculado c
   WHERE t.id = c.id
     AND t.sla_status IS DISTINCT FROM c.novo;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Aviso prévio ao técnico responsável quando o chamado está na faixa "attention"
  -- (ainda não vencido). Reenvia no máximo a cada 4h para não spammar enquanto o
  -- chamado permanece nessa faixa entre execuções do cron.
  INSERT INTO notifications (user_id, title, message, link)
  SELECT
    t.assigned_to_user_id,
    'SLA próximo do vencimento',
    'O chamado #' || t.ticket_number || ' (' || t.title || ') está próximo do prazo de SLA.',
    '/ticket/' || t.id
  FROM tickets t
  WHERE t.sla_status = 'attention'
    AND t.assigned_to_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = t.assigned_to_user_id
        AND n.link = '/ticket/' || t.id
        AND n.title = 'SLA próximo do vencimento'
        AND n.created_at > NOW() - INTERVAL '4 hours'
    );

  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_technician_workload(p_company_id uuid)
RETURNS TABLE(technician_id uuid, technician_name text, open_tickets bigint, sla_at_risk_tickets bigint, resolved_today bigint)
LANGUAGE plpgsql
-- Continua SECURITY DEFINER, como antes: soma chamados de técnicos que a RLS
-- de quem pergunta não deixaria ler um a um. A checagem de acesso fica no
-- início do corpo.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    -- Equipe da empresa-mãe atende chamados de todas as empresas: para ela a
    -- carga é global. Os demais veem só a própria empresa.
    v_global boolean := public.is_master_company_user(auth.uid());
BEGIN
    IF NOT (
        v_global
        OR p_company_id = public.get_user_company_id(auth.uid())
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
