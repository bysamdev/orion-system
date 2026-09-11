-- =================================================================================
-- Migration: 20260911150000_resolver_chamado_transacional.sql
--
-- Achado ORI-P1-02 (auditoria 2026-09-11): mutações de chamado não são
-- atômicas. O cliente atualiza a linha do ticket numa requisição e insere a
-- timeline em outra, então o banco pode ficar num estado válido sem trilha
-- de auditoria nem notificação.
--
-- Esta migration ataca primeiro o caso mais perigoso, useResolveTicket
-- (src/hooks/useTickets.ts): quando o INSERT na timeline falhava, o cliente
-- tentava desfazer a resolução com
--
--     UPDATE tickets SET status = <anterior> WHERE id = $1
--
-- sem nenhuma precondição de versão. Se outro técnico tivesse alterado o
-- chamado nesse intervalo, esse "rollback" sobrescrevia a alteração dele —
-- perda de atualização silenciosa, pior que a falha original. O caminho
-- feliz tinha lock otimista por updated_at; o de compensação, não.
--
-- Desenho:
--
-- SECURITY INVOKER (padrão, deliberado — não trocar para DEFINER). tickets
-- e ticket_updates têm políticas de RLS distintas por papel (technician,
-- admin, master admin, developer, dono do chamado). Rodando como invoker,
-- todas continuam valendo exatamente como hoje e a autorização permanece
-- num lugar só. Um SECURITY DEFINER contornaria a RLS e exigiria
-- reimplementar essa matriz aqui dentro, criando a duplicidade que a
-- auditoria alerta que precisa de teste de paridade.
--
-- Não mexemos em author/author_id: set_ticket_update_author (BEFORE INSERT)
-- já força author_id := auth.uid() e preenche author pelo profiles. O que o
-- cliente mandava nesses campos sempre foi descartado.
--
-- Também não duplicamos o histórico de status: log_ticket_status_change
-- (AFTER UPDATE) já grava em ticket_status_history dentro da mesma
-- transação. A linha em ticket_updates é a timeline visível ao usuário, e é
-- ela que dispara create_notification_on_ticket_update.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.resolver_chamado(
  p_ticket_id uuid,
  p_notes text,
  p_resolution_content text,
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
  SET status           = 'resolved',
      resolution_notes = p_notes,
      resolved_at      = now()
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    -- Zero linhas tem três causas possíveis, e a mensagem muda o que o
    -- usuário deve fazer: recarregar (alguém alterou antes) ou parar
    -- (não existe / sem permissão). Separamos as duas com um SELECT que
    -- passa pela mesma RLS do UPDATE.
    IF EXISTS (SELECT 1 FROM public.tickets WHERE id = p_ticket_id) THEN
      RAISE EXCEPTION 'Conflito de concorrência: o chamado foi modificado por outro técnico.'
        USING ERRCODE = '40001';
    END IF;
    RAISE EXCEPTION 'Chamado não encontrado ou sem permissão para resolvê-lo.'
      USING ERRCODE = '42501';
  END IF;

  -- Mesma transação do UPDATE: ou os dois valem, ou nenhum. É isto que
  -- torna o rollback compensatório do cliente desnecessário.
  INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
  VALUES
    (p_ticket_id, 'Status alterado para: Resolvido', 'status_change', '', false),
    (p_ticket_id, p_resolution_content,              'comment',       '', false);

  RETURN v_ticket;
END;
$$;

-- service_role não precisa de GRANT (contorna), e anon não tem o que fazer
-- aqui: resolver chamado exige sessão autenticada.
REVOKE ALL ON FUNCTION public.resolver_chamado(uuid, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolver_chamado(uuid, text, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolver_chamado(uuid, text, text, timestamptz) TO authenticated;
