-- =============================================================================
-- Migration: 20260911120200_fix_ch_c04b_customer_ticket_update_allowlist.sql
--
-- Complemento de CH-C04: trocar a lista negra de colunas por lista branca
--
-- Descrição:
--   20260904100200 restaura para OLD uma lista fixa de colunas
--   (company_id, priority, assigned_to*, sla_due_date, sla_status,
--   ticket_number, user_id) quando o dono do chamado faz UPDATE. Todas as
--   outras colunas de public.tickets continuam livres no caminho de
--   reabertura — resolved_at, first_response_at, resolution_notes, category,
--   sla_paused_at, sla_accumulated_pause_minutes, colunas de contrato e de
--   metadados — e qualquer coluna adicionada no futuro já nasce desprotegida.
--
-- O QUE MUDA:
--   O dono do chamado que não é equipe interna só consegue alterar status e
--   updated_at. A linha nova é montada a partir de OLD com apenas essas duas
--   colunas aplicadas por cima. Os demais valores são restaurados
--   silenciosamente, como antes, para não quebrar clientes que enviam a linha
--   inteira de volta.
--
-- CAMINHOS LEGÍTIMOS VERIFICADOS:
--   - Reabertura ("Customers can reopen own tickets"): só precisa de status.
--     Os campos de SLA recalculados na reabertura são escritos pelos triggers
--     BEFORE UPDATE que disparam depois deste (ordem alfabética, prefixo aa_),
--     então não são afetados.
--   - tr_auto_resume_on_customer_reply: roda na sessão do cliente e faz
--     UPDATE tickets SET status, updated_at — ambos na lista branca.
--   - tr_auto_route_ticket é BEFORE INSERT e não passa por aqui.
--   - O frontend não tem nenhum outro UPDATE em tickets feito pelo cliente.
--
-- CAMINHOS NÃO AFETADOS (inalterados em relação a 20260904100200):
--   auth.uid() IS NULL, is_equipe_interna(), e usuários que não são donos.
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

  -- Lista branca: parte de OLD e aplica por cima só o que o cliente pode mudar.
  RETURN jsonb_populate_record(
    OLD,
    jsonb_build_object('status', NEW.status, 'updated_at', NEW.updated_at)
  );
END;
$function$;

COMMENT ON FUNCTION public.enforce_customer_ticket_immutability() IS
  'CH-C04: o dono do chamado fora da equipe interna só altera status e '
  'updated_at; todas as demais colunas são restauradas para OLD. A policy RLS '
  'não consegue comparar com OLD, por isso a regra vive aqui.';

-- O trigger aa_enforce_customer_ticket_immutability criado em 20260904100200
-- continua apontando para esta função; não precisa ser recriado.

-- Teste manual sugerido, com sessão do customer dono de um chamado resolvido
-- (resolution_notes e category devem permanecer os originais):
--
--   UPDATE public.tickets
--   SET status = 'reopened', resolution_notes = 'x', category = 'y'
--   WHERE id = '<uuid do chamado>'
--   RETURNING status, resolution_notes, category;
