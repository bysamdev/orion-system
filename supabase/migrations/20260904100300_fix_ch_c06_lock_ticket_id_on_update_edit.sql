-- =============================================================================
-- Migration: 20260904100300_fix_ch_c06_lock_ticket_id_on_update_edit.sql
--
-- Fix CH-C06: pin ticket_id when an author edits a recent ticket update
--
-- Descrição:
--   A policy de edição de comentário em public.ticket_updates:
--
--     "Authors can edit recent updates" UPDATE
--     USING ((author_id = auth.uid()) AND (created_at > now() - '00:15:00'::interval))
--     WITH CHECK  -> NULL
--
--   Com WITH CHECK nulo o Postgres reutiliza a expressão do USING para validar
--   a linha nova. Nenhuma das duas restringe ticket_id. Resultado: dentro da
--   janela de 15 minutos o autor consegue dar UPDATE no próprio comentário
--   apontando-o para QUALQUER UUID de chamado da plataforma, injetando conteúdo
--   na timeline de outro tenant sob o próprio nome.
--
--   Encadeia com CH-B01: GET /api/tickets/resolve/{id} entrega a qualquer
--   técnico o UUID de chamado de outro tenant, que é exatamente a entrada
--   necessária para este movimento.
--
-- POR QUE ISTO É UM TRIGGER E NÃO UM WITH CHECK:
--   Mesma limitação de CH-C04: uma policy RLS não enxerga OLD, então não existe
--   forma de escrever "ticket_id não pode mudar" dentro dela. WITH CHECK só
--   consegue validar a linha nova isoladamente. A imutabilidade exige trigger
--   BEFORE UPDATE.
--
-- POR QUE A REGRA NÃO É ABSOLUTA:
--   Dois caminhos legítimos movem ticket_updates entre chamados e seriam
--   quebrados por um travamento cego (verificado em pg_proc.prosrc):
--     public.fn_merge_tickets   (SECURITY INVOKER) — merge de chamados
--     public.merge_user_data    (SECURITY DEFINER) — consolidação de usuários
--   Ambos são operações de equipe interna. Por isso a regra isenta
--   is_equipe_interna() e as sessões sem auth.uid() (cron, service_role,
--   backend). O que ela fecha é o caminho do cliente autor, que é o vetor do
--   achado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_ticket_update_ticket_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.ticket_id IS NOT DISTINCT FROM OLD.ticket_id THEN
    RETURN NEW;
  END IF;

  -- Sem sessão de usuário: cron, service_role, backend Go.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Merge de chamados e consolidação de usuários são operações de equipe interna.
  IF public.is_equipe_interna((SELECT auth.uid())) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'ticket_id de um comentário não pode ser alterado (comentário %, chamado % -> %)',
    OLD.id, OLD.ticket_id, NEW.ticket_id
    USING ERRCODE = '42501';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_ticket_update_ticket_id_immutability() FROM anon, authenticated;

DROP TRIGGER IF EXISTS aa_enforce_ticket_update_ticket_id_immutability ON public.ticket_updates;

CREATE TRIGGER aa_enforce_ticket_update_ticket_id_immutability
BEFORE UPDATE ON public.ticket_updates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ticket_update_ticket_id_immutability();

COMMENT ON FUNCTION public.enforce_ticket_update_ticket_id_immutability() IS
  'CH-C06: impede que o autor de um comentário o reaponte para outro chamado. '
  'Isenta equipe interna para não quebrar fn_merge_tickets e merge_user_data.';

-- Verificação pós-aplicação:
--
--   SELECT tgname, pg_get_triggerdef(oid)
--   FROM pg_trigger
--   WHERE tgrelid = 'public.ticket_updates'::regclass AND NOT tgisinternal
--   ORDER BY tgname;
--
-- Teste manual sugerido, com sessão de um usuário customer que acabou de
-- comentar no próprio chamado (deve falhar com SQLSTATE 42501):
--
--   UPDATE public.ticket_updates
--   SET ticket_id = '<uuid de outro chamado>'
--   WHERE id = '<uuid do comentário recém-criado>';
