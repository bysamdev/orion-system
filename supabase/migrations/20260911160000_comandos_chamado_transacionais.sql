-- =================================================================================
-- Migration: 20260911160000_comandos_chamado_transacionais.sql
--
-- Conclui o ORI-P1-02, completando o que 20260911150000 começou com
-- resolver_chamado. Os cinco comandos restantes de src/hooks/useTickets.ts
-- (assumir, atribuir, alterar status, alterar prioridade, escalar) tinham
-- todos o mesmo defeito: UPDATE do ticket numa requisição, INSERT da timeline
-- em outra, e um "rollback" compensatório sem precondição de versão —
--
--     UPDATE tickets SET <campo> = <anterior> WHERE id = $1
--
-- que sobrescrevia a alteração de qualquer outro técnico que tivesse mexido
-- no chamado no intervalo. O caminho feliz de cada um tinha lock otimista por
-- updated_at; o de compensação, nenhum.
--
-- Todas SECURITY INVOKER (padrão, deliberado — não trocar para DEFINER):
-- tickets e ticket_updates têm políticas de RLS por papel, e como invoker
-- elas continuam sendo a única fonte de autorização. Ver a justificativa
-- completa em 20260911150000_resolver_chamado_transacional.sql.
--
-- author/author_id não são passados: set_ticket_update_author (BEFORE INSERT)
-- já força author_id := auth.uid() e resolve author pelo profiles.
-- =================================================================================

-- ---------------------------------------------------------------------------
-- Correção de trigger: notificação de atribuição disparava em toda atualização
--
-- notify_ticket_assignment checava só "assigned_to_user_id IS NOT NULL", sem
-- comparar com OLD. Resultado: qualquer UPDATE num chamado atribuído —
-- mudar status, prioridade, resolver — renotificava o responsável com "Novo
-- chamado atribuído a você". Em produção já havia 7 notificações para 6
-- chamados distintos, e o erro escala com o uso.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_ticket_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.assigned_to_user_id IS NOT NULL
     AND NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
    INSERT INTO notifications (user_id, title, message, link, is_read)
    VALUES (
      NEW.assigned_to_user_id,
      'Novo chamado atribuído a você',
      'O chamado #' || NEW.ticket_number || ' foi atribuído a você.',
      '/ticket/' || NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Erro padrão de versão/permissão, igual em todos os comandos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.falhar_comando_chamado(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tickets WHERE id = p_ticket_id) THEN
    RAISE EXCEPTION 'Conflito de concorrência: o chamado foi modificado por outro técnico.'
      USING ERRCODE = '40001';
  END IF;
  RAISE EXCEPTION 'Chamado não encontrado ou sem permissão.'
    USING ERRCODE = '42501';
END;
$$;

-- ---------------------------------------------------------------------------
-- assumir_chamado: técnico pega o chamado para si.
--
-- assigned_to_user_id vem de auth.uid(), não do cliente: quem assume é sempre
-- quem está chamando, e mandar o id pela rede só criava a chance de divergir.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assumir_chamado(
  p_ticket_id uuid,
  p_user_name text,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  UPDATE public.tickets
  SET assigned_to         = p_user_name,
      assigned_to_user_id = auth.uid(),
      status              = 'in-progress'
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
  VALUES (p_ticket_id,
          format('Chamado assumido por %s (Status alterado para: Em Atendimento)', p_user_name),
          'assignment', '', false);

  RETURN v_ticket;
END;
$$;

-- ---------------------------------------------------------------------------
-- atribuir_chamado: atribuir a outra pessoa (ou desatribuir com NULL).
-- ---------------------------------------------------------------------------
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
  UPDATE public.tickets
  SET assigned_to         = p_assigned_to,
      assigned_to_user_id = p_assigned_to_user_id
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

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

-- ---------------------------------------------------------------------------
-- alterar_status_chamado
--
-- A interface antiga aceitava assigned_to, assigned_to_user_id, sla_paused_at,
-- sla_accumulated_pause_minutes, resolution_notes e expected_status. Nenhum
-- chamador passava nada disso, e o SLA é pausado por trigger no banco
-- (tr_ticket_sla_pause_trigger), então a superfície real é só o status mais a
-- linha de timeline.
-- ---------------------------------------------------------------------------
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
BEGIN
  UPDATE public.tickets
  SET status = p_status
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  IF p_update_content IS NOT NULL THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, p_update_content, p_update_type, '', p_is_internal);
  END IF;

  RETURN v_ticket;
END;
$$;

-- ---------------------------------------------------------------------------
-- alterar_prioridade_chamado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_prioridade_chamado(
  p_ticket_id uuid,
  p_priority text,
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
  UPDATE public.tickets
  SET priority = p_priority
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  IF p_update_content IS NOT NULL THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, p_update_content, 'priority_change', '', false);
  END IF;

  RETURN v_ticket;
END;
$$;

-- ---------------------------------------------------------------------------
-- escalar_chamado: muda prioridade e/ou responsável e registra o motivo.
--
-- O que mudou é decidido aqui, comparando com a linha travada por FOR UPDATE,
-- e não pelos valores "atuais" que o cliente enviava (currentPriority,
-- currentAssignedTo): aqueles vinham da tela e podiam estar defasados, o que
-- fazia a timeline descrever uma transição que não aconteceu.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalar_chamado(
  p_ticket_id uuid,
  p_technician_name text,
  p_technician_user_id uuid,
  p_new_priority text,
  p_reason text,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket            public.tickets;
  v_prioridade_antiga text;
  v_responsavel_antigo text;
  v_prioridade_mudou  boolean;
  v_responsavel_mudou boolean;
  v_versao_atual      timestamptz;
  v_novo_responsavel  text := NULLIF(p_technician_name, 'unassigned');
BEGIN
  SELECT priority, assigned_to, updated_at
    INTO v_prioridade_antiga, v_responsavel_antigo, v_versao_atual
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND
     OR (p_expected_updated_at IS NOT NULL AND v_versao_atual <> p_expected_updated_at) THEN
    PERFORM public.falhar_comando_chamado(p_ticket_id);
  END IF;

  v_prioridade_mudou  := p_new_priority IS NOT NULL
                         AND p_new_priority IS DISTINCT FROM v_prioridade_antiga;
  v_responsavel_mudou := v_novo_responsavel IS DISTINCT FROM v_responsavel_antigo;

  UPDATE public.tickets
  SET priority            = COALESCE(p_new_priority, priority),
      assigned_to         = CASE WHEN v_responsavel_mudou THEN v_novo_responsavel ELSE assigned_to END,
      assigned_to_user_id = CASE WHEN v_responsavel_mudou THEN p_technician_user_id ELSE assigned_to_user_id END
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  IF v_prioridade_mudou THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id, format('Prioridade escalada para: %s', p_new_priority),
            'priority_change', '', false);
  END IF;

  IF v_responsavel_mudou THEN
    INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
    VALUES (p_ticket_id,
            format('Chamado escalado para: %s', COALESCE(v_novo_responsavel, 'Fila Geral')),
            'assignment', '', false);
  END IF;

  INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
  VALUES (p_ticket_id, format('[ESCALAÇÃO] Motivo: %s', p_reason), 'comment', '', true);

  RETURN v_ticket;
END;
$$;

-- ---------------------------------------------------------------------------
-- Nenhuma delas faz sentido para anon: todo comando exige sessão autenticada.
-- service_role contorna e não precisa de GRANT.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_assinatura text;
BEGIN
  FOREACH v_assinatura IN ARRAY ARRAY[
    'public.falhar_comando_chamado(uuid)',
    'public.assumir_chamado(uuid, text, timestamptz)',
    'public.atribuir_chamado(uuid, text, uuid, text, timestamptz)',
    'public.alterar_status_chamado(uuid, text, text, text, boolean, timestamptz)',
    'public.alterar_prioridade_chamado(uuid, text, text, timestamptz)',
    'public.escalar_chamado(uuid, text, uuid, text, text, timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_assinatura);
  END LOOP;
END $$;
