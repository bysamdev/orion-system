-- =============================================================================
-- Migration: 20260904100200_fix_ch_c04_lock_customer_reopen_columns.sql
--
-- Fix CH-C04: lock privileged columns on the customer reopen path
--
-- Descrição:
--   A policy de UPDATE que permite o cliente reabrir o próprio chamado:
--
--     "Customers can reopen own tickets" UPDATE
--     USING      ((user_id = auth.uid()) AND (status = ANY (ARRAY['closed','resolved'])))
--     WITH CHECK ((user_id = auth.uid()) AND (status = 'reopened'))
--
--   restringe apenas user_id e status. Todas as outras colunas da linha nova
--   ficam livres, então um UPDATE direto no PostgREST que também define
--   status = 'reopened' consegue, no mesmo comando:
--     - trocar company_id, movendo o chamado para outro tenant enquanto
--       continua visível pelo ramo user_id = auth.uid() de select_tickets;
--     - elevar priority para 'urgent', o que faz trigger_update_sla_on_priority_change
--       recalcular o SLA;
--     - definir assigned_to para qualquer técnico/admin/developer de qualquer
--       empresa, porque validate_ticket_assignment resolve o nome sem
--       predicado de empresa.
--
--   Verificado que não havia mitigação: trigger_set_ticket_company
--   (set_ticket_company_from_user) re-deriva company_id, mas é BEFORE INSERT
--   apenas — nenhum trigger re-deriva company_id no UPDATE.
--
-- POR QUE ISTO É UM TRIGGER E NÃO UM WITH CHECK:
--   Uma policy RLS não enxerga OLD. Dentro da policy existe uma única linha:
--   USING avalia a linha existente, WITH CHECK avalia a linha nova, e não há
--   sintaxe para comparar as duas. Travar uma coluna contra o valor anterior
--   só é possível em trigger BEFORE UPDATE, onde OLD e NEW coexistem. A policy
--   permanece como está; a imutabilidade é imposta aqui.
--
-- NOME DO TRIGGER:
--   Prefixo 'aa_' é deliberado. Triggers BEFORE de mesma tabela e mesmo evento
--   disparam em ordem alfabética de nome, e este precisa rodar ANTES de
--   trigger_update_sla_on_priority_change e validate_ticket_assignment_trigger,
--   senão o SLA seria recalculado a partir da priority adulterada antes de ela
--   ser restaurada.
--
-- ESCOPO DA REGRA:
--   Só se aplica ao dono do chamado que não é equipe interna. Em particular:
--     - auth.uid() IS NULL (cron, service_role, backend Go com pool privilegiado)
--       passa direto e nada muda;
--     - is_equipe_interna(auth.uid()) passa direto — técnico, developer e admin
--       de empresa master seguem podendo repriorizar e reatribuir;
--     - qualquer outro usuário mexendo em chamado que não é dele não é alvo
--       desta regra (a própria RLS já barra).
--   As colunas são restauradas silenciosamente ao valor anterior em vez de
--   levantar exceção, para não quebrar a reabertura legítima pela UI, que envia
--   o registro inteiro de volta.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_customer_ticket_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Sem sessão de usuário: cron, service_role ou o pool privilegiado do
  -- backend Go. Estes caminhos já têm autorização própria.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Equipe interna mantém poder de repriorizar, reatribuir e ajustar SLA.
  IF public.is_equipe_interna((SELECT auth.uid())) THEN
    RETURN NEW;
  END IF;

  -- A regra vale para o dono do chamado agindo como cliente.
  IF OLD.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.company_id          := OLD.company_id;
  NEW.priority            := OLD.priority;
  NEW.assigned_to         := OLD.assigned_to;
  NEW.assigned_to_user_id := OLD.assigned_to_user_id;
  NEW.sla_due_date        := OLD.sla_due_date;
  NEW.sla_status          := OLD.sla_status;
  NEW.ticket_number       := OLD.ticket_number;
  NEW.user_id             := OLD.user_id;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_customer_ticket_immutability() FROM anon, authenticated;

DROP TRIGGER IF EXISTS aa_enforce_customer_ticket_immutability ON public.tickets;

CREATE TRIGGER aa_enforce_customer_ticket_immutability
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_customer_ticket_immutability();

COMMENT ON FUNCTION public.enforce_customer_ticket_immutability() IS
  'CH-C04: impede que o cliente altere company_id, priority, assigned_to*, sla_* '
  'ou ticket_number no mesmo UPDATE que reabre o chamado. A policy RLS não '
  'consegue comparar com OLD, por isso a regra vive aqui.';

-- Verificação pós-aplicação — ordem de disparo dos triggers BEFORE UPDATE.
-- aa_enforce_customer_ticket_immutability deve aparecer primeiro:
--
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.tickets'::regclass
--     AND NOT tgisinternal AND (tgtype::int & 2) = 2 AND (tgtype::int & 16) = 16
--   ORDER BY tgname;
