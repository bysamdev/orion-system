-- ORN-BUG-15: mudança de status sem texto não deixava rastro.
--
-- alterar_status_chamado só gravava o ticket_update (que alimenta o histórico
-- e a notificação ao cliente) quando o chamador mandava p_update_content. Uma
-- chamada sem texto mudava o status em silêncio. A tela do chamado hoje
-- sempre manda texto, mas qualquer outro caminho (API, automação futura)
-- ficaria sem histórico nem aviso.
--
-- Agora, quando o status muda de fato e não veio texto, grava "Status
-- alterado para <status>". Continua exigindo sessão (ticket_updates.author_id
-- vem de auth.uid()); chamada sem sessão segue como antes.

CREATE OR REPLACE FUNCTION public.alterar_status_chamado(
  p_ticket_id uuid,
  p_status text,
  p_update_content text DEFAULT NULL::text,
  p_update_type text DEFAULT 'status_change'::text,
  p_is_internal boolean DEFAULT false,
  p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS tickets
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.tickets;
  v_uid uuid := auth.uid();
  v_responsavel_antes uuid;
  v_status_antes text;
  v_assume boolean;
  v_texto text := p_update_content;
BEGIN
  SELECT assigned_to_user_id, status INTO v_responsavel_antes, v_status_antes
    FROM public.tickets WHERE id = p_ticket_id;

  -- Só equipe interna assume. Sem sessão (service_role, cron) ou com sessão
  -- de cliente, o comportamento é o de antes: troca só o status.
  v_assume := p_status = 'in-progress'
              AND v_responsavel_antes IS NULL
              AND v_uid IS NOT NULL
              AND public.is_equipe_interna(v_uid);

  UPDATE public.tickets t
  SET status              = p_status,
      -- sync_ticket_assignment preenche assigned_to com o nome do perfil.
      assigned_to_user_id = CASE
                              WHEN v_assume AND t.assigned_to_user_id IS NULL THEN v_uid
                              ELSE t.assigned_to_user_id
                            END
  WHERE t.id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR t.updated_at = p_expected_updated_at)
  RETURNING t.* INTO v_ticket;

  IF NOT FOUND THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  IF v_texto IS NULL AND v_uid IS NOT NULL AND v_status_antes IS DISTINCT FROM p_status THEN
    v_texto := 'Status alterado para ' || CASE p_status
      WHEN 'open' THEN 'Aberto'
      WHEN 'in-progress' THEN 'Em Atendimento'
      WHEN 'awaiting-customer' THEN 'Aguardando Cliente'
      WHEN 'awaiting-third-party' THEN 'Aguardando Terceiro'
      WHEN 'resolved' THEN 'Resolvido'
      WHEN 'closed' THEN 'Fechado'
      WHEN 'reopened' THEN 'Reaberto'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE p_status
    END;
  END IF;

  IF v_texto IS NOT NULL THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, v_texto, p_update_type, '', p_is_internal);
  END IF;

  -- O CASE do UPDATE ainda confere t.assigned_to_user_id IS NULL: se alguém
  -- assumiu entre a leitura e o UPDATE, ninguém é sobrescrito, e aqui o
  -- responsável não é quem chamou.
  IF v_assume AND v_ticket.assigned_to_user_id = v_uid THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id,
            format('Chamado assumido por %s ao mudar o status para Em Atendimento', v_ticket.assigned_to),
            'assignment', '', false);
  END IF;

  RETURN v_ticket;
END;
$$;
