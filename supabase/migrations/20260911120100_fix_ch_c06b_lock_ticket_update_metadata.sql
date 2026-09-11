-- =============================================================================
-- Migration: 20260911120100_fix_ch_c06b_lock_ticket_update_metadata.sql
--
-- Complemento de CH-C06: travar created_at, autor, tipo e visibilidade na
-- edição de comentário
--
-- Descrição:
--   A policy "Authors can edit recent updates" de public.ticket_updates não
--   tem WITH CHECK, então o Postgres reutiliza o USING
--     (author_id = auth.uid() AND created_at > now() - '15 minutes')
--   para validar a linha nova. created_at não é travado em lugar nenhum:
--   o autor pode enviar created_at = now() junto com a edição e a janela de
--   15 minutos se renova a cada UPDATE — o comentário fica editável para
--   sempre e a ordem da timeline pode ser falsificada.
--
--   20260904100300 travou apenas ticket_id. Pelo mesmo motivo daquela
--   migration (policy RLS não enxerga OLD), a correção precisa ser trigger.
--
-- O QUE MUDA:
--   Para sessões de usuário que não são equipe interna, a edição passa a ser
--   restrita a uma lista branca: apenas content pode mudar. As demais colunas
--   (author_id, author, created_at, type, is_internal) são restauradas
--   silenciosamente para OLD — mesma estratégia de CH-C04, para não quebrar
--   clientes que enviam a linha inteira de volta. ticket_id continua
--   levantando exceção, como já fazia.
--
--   Lista branca em vez de lista negra: qualquer coluna adicionada a
--   ticket_updates no futuro já nasce protegida.
--
-- CAMINHOS NÃO AFETADOS:
--   - auth.uid() IS NULL (cron, service_role, backend Go);
--   - is_equipe_interna() — fn_merge_tickets e merge_user_data, que movem e
--     reatribuem comentários, são operações de equipe interna.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_ticket_update_ticket_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Sem sessão de usuário: cron, service_role, backend Go.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Merge de chamados e consolidação de usuários são operações de equipe interna.
  IF public.is_equipe_interna((SELECT auth.uid())) THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id THEN
    RAISE EXCEPTION
      'ticket_id de um comentário não pode ser alterado (comentário %, chamado % -> %)',
      OLD.id, OLD.ticket_id, NEW.ticket_id
      USING ERRCODE = '42501';
  END IF;

  -- Lista branca: parte de OLD e aplica por cima só o que pode ser editado.
  RETURN jsonb_populate_record(OLD, jsonb_build_object('content', NEW.content));
END;
$function$;

COMMENT ON FUNCTION public.enforce_ticket_update_ticket_id_immutability() IS
  'CH-C06: fora da equipe interna, só content de um comentário pode ser editado. '
  'ticket_id levanta exceção; demais colunas (created_at, author*, type, '
  'is_internal) são restauradas para OLD.';

-- O trigger aa_enforce_ticket_update_ticket_id_immutability criado em
-- 20260904100300 continua apontando para esta função; não precisa ser recriado.

-- Teste manual sugerido, com sessão de um customer que acabou de comentar
-- (created_at deve permanecer o original):
--
--   UPDATE public.ticket_updates
--   SET content = 'editado', created_at = now() + interval '1 day'
--   WHERE id = '<uuid do comentário recém-criado>'
--   RETURNING content, created_at;
