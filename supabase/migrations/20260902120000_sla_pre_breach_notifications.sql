-- Item 1.7 (acabamento MVP): update_all_tickets_sla_status() já existe mas nunca era chamada
-- periodicamente (o comentário original da função já pedia isso: "Deve ser chamada
-- periodicamente (cron/scheduler)"). Sem isso, um chamado parado só é reavaliado quando
-- alguém edita o ticket, podendo pular direto de "ok" para "breached" sem aviso prévio.
--
-- Esta migração é aditiva: agenda a função existente via pg_cron (extensão já habilitada
-- em 20260614000000_setup_pg_cron_cleanup.sql) e acrescenta ao final da própria função um
-- aviso prévio para o técnico responsável quando o chamado entra na faixa "attention".

CREATE OR REPLACE FUNCTION public.update_all_tickets_sla_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Atualizar status de SLA usando percentual restante
  UPDATE tickets
  SET sla_status = CASE
    WHEN NOW() > sla_due_date THEN 'breached'
    WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 10
         OR EXTRACT(EPOCH FROM (sla_due_date - NOW())) <= 7200 THEN 'attention'
    WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 25 THEN 'warning'
    ELSE 'ok'
  END
  WHERE status NOT IN ('resolved', 'closed', 'cancelled', 'awaiting-customer', 'awaiting-third-party')
    AND sla_due_date IS NOT NULL
    AND sla_due_date > created_at;

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

-- Recalcula o SLA de todos os chamados abertos a cada 15 minutos.
SELECT cron.schedule(
  'sla-status-recalc',
  '*/15 * * * *',
  $$SELECT public.update_all_tickets_sla_status()$$
);
