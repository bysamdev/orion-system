-- =============================================================================
-- Chamado "Em Atendimento" sempre tem responsável
-- =============================================================================
--
-- O seletor de status da tela do chamado chama alterar_status_chamado, que só
-- trocava o status. Mudar para in-progress por ali deixava o chamado em
-- atendimento sem ninguém atribuído: fora da Fila de espera (que só lista
-- open/reopened/aguardando) e fora de "Meus chamados" de todo mundo. Foi o que
-- aconteceu com #1174 (28/08) e #1184 (31/08), que ficaram três semanas
-- invisíveis com o SLA vencido. Pela auditoria, 3 dos 15 chamados que
-- entraram em atendimento desde 22/06 entraram assim.
--
-- O frontend já prometia o contrário: o toast de useUpdateTicketStatus diz
-- "Você foi atribuído ao chamado" quando o status volta in-progress com
-- responsável.
--
-- Duas portas fechadas aqui:
--   1. alterar_status_chamado para in-progress num chamado sem responsável
--      atribui a quem mudou o status, se for equipe interna (o mesmo que o
--      botão Assumir faz).
--   2. atribuir_chamado com NULL num chamado in-progress devolve o status para
--      open, para ele voltar à Fila de espera em vez de sumir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.alterar_status_chamado(
  p_ticket_id uuid,
  p_status text,
  p_update_content text DEFAULT NULL,
  p_update_type text DEFAULT 'status_change',
  p_is_internal boolean DEFAULT false,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.tickets;
  v_uid uuid := auth.uid();
  v_responsavel_antes uuid;
  v_assume boolean;
BEGIN
  SELECT assigned_to_user_id INTO v_responsavel_antes
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

  IF p_update_content IS NOT NULL THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, p_update_content, p_update_type, '', p_is_internal);
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

CREATE OR REPLACE FUNCTION public.atribuir_chamado(
  p_ticket_id uuid,
  p_assigned_to text,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_update_content text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  UPDATE public.tickets t
  SET assigned_to         = p_assigned_to,
      assigned_to_user_id = p_assigned_to_user_id,
      -- Desatribuir quem está em atendimento devolve o chamado à fila.
      status              = CASE
                              WHEN p_assigned_to IS NULL AND p_assigned_to_user_id IS NULL
                                   AND t.status = 'in-progress' THEN 'open'
                              ELSE t.status
                            END
  WHERE t.id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR t.updated_at = p_expected_updated_at)
  RETURNING t.* INTO v_ticket;

  IF NOT FOUND THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  IF p_update_content IS NOT NULL THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, p_update_content, 'assignment', '', false);
  END IF;

  RETURN v_ticket;
END;
$$;
