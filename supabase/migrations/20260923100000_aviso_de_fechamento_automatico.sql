-- ORN-BUG-07: os fechamentos automáticos não avisavam o cliente.
--
-- auto_close_resolved_tickets (resolvido há 48h) e
-- fechar_chamados_em_pausa_sem_resposta (aguardando cliente há 3 dias úteis)
-- fecham o chamado por UPDATE direto, sem ticket_update, e o aviso ao
-- cliente só nascia de ticket_update. O chamado sumia da lista de abertos sem
-- nenhuma notificação. Agora cada função avisa o solicitante do que fechou.

CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  closed_count integer;
BEGIN
  WITH alvo AS (
    UPDATE public.tickets
       SET status = 'closed', updated_at = now()
     WHERE status = 'resolved'
       AND resolved_at < now() - interval '48 hours'
    RETURNING id, user_id, ticket_number, title
  ), avisos AS (
    INSERT INTO public.notifications (user_id, title, message, link)
    SELECT user_id,
           'Chamado encerrado',
           'O chamado #' || ticket_number || ' (' || title || ') foi encerrado automaticamente 48 horas depois de resolvido.',
           '/ticket/' || id
      FROM alvo
     WHERE user_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO closed_count FROM alvo;

  RETURN closed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fechar_chamados_em_pausa_sem_resposta()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  fechados integer;
BEGIN
  WITH alvo AS (
    UPDATE public.tickets
       SET status     = 'closed',
           updated_at = now(),
           metadata   = coalesce(metadata, '{}'::jsonb)
                        || jsonb_build_object('fechado_por_inatividade', true,
                                              'fechado_por_inatividade_em', now())
     WHERE status = 'awaiting-customer'
       AND sla_paused_at IS NOT NULL
       AND now() >= public.adiciona_dias_uteis(sla_paused_at, 3)
    RETURNING id, user_id, ticket_number, title
  ), avisos AS (
    INSERT INTO public.notifications (user_id, title, message, link)
    SELECT user_id,
           'Chamado encerrado por falta de resposta',
           'O chamado #' || ticket_number || ' (' || title || ') foi encerrado porque ficou 3 dias úteis aguardando sua resposta. Se o problema continuar, abra um novo chamado.',
           '/ticket/' || id
      FROM alvo
     WHERE user_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO fechados FROM alvo;

  RETURN fechados;
END;
$$;
