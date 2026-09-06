-- =============================================================================
-- Migration: 20260904100000_fix_ch_c12_revoke_anon_execute_on_ticket_write_rpcs.sql
--
-- Fix CH-C12: revoke anon execute on unauthenticated write RPCs
--
-- Descrição:
--   Três funções SECURITY DEFINER que ESCREVEM em public.tickets estavam
--   executáveis por anon e authenticated via /rest/v1/rpc, sem nenhuma
--   checagem de autorização no corpo. Como o owner é postgres, elas rodam
--   sem RLS e atravessam todos os tenants.
--
--     public.auto_close_resolved_tickets()    -> UPDATE tickets SET status='closed'
--     public.update_all_tickets_sla_status()  -> UPDATE tickets SET sla_status
--                                                + INSERT INTO notifications
--     public.fn_auto_assign_ticket(uuid)      -> UPDATE tickets SET assigned_to*
--
--   Mesmo padrão já aplicado a get_decrypted_remote_password em
--   20260901220000_fix_p0_authorization_and_rls.sql. Verificado que aquele
--   REVOKE surtiu efeito (anon_exec = false hoje), e que as ACLs destas
--   funções são explícitas — não herdadas do EXECUTE default de PUBLIC —
--   portanto revogar de anon e authenticated é suficiente.
--
-- Dependência de cron verificada antes de revogar (cron.job em produção):
--   jobid 1 'auto-close-resolved-tickets'  0 * * * *     username=postgres
--   jobid 6 'sla-status-recalc'            */15 * * * *  username=postgres
--   Ambos rodam como postgres, que é o OWNER das funções e mantém EXECUTE
--   independentemente deste REVOKE. Nenhum job roda como anon/authenticated,
--   então o agendamento continua funcionando sem alteração.
--
--   fn_auto_assign_ticket não tem nenhum chamador: nenhum cron.job, nenhum
--   corpo de função em public (pg_proc.prosrc), e nenhuma chamada .rpc() no
--   frontend ou no backend Go. A variante sem argumento retorna trigger e não
--   está anexada a nenhum trigger de public.tickets. Ambas as variantes são
--   revogadas; a remoção definitiva fica como decisão separada.
--
--   service_role mantém EXECUTE, para o caso de a chamada ser movida para um
--   Edge Function ou para o backend.
-- =============================================================================

-- GUARDA DE REPLAY (adicionada após o diagnóstico do MIGRATIONS_FAILED):
--   public.fn_auto_assign_ticket(uuid) NÃO é criada por migration alguma deste
--   repositório. 20260621000001_auto_assign_tickets.sql:3 cria apenas a
--   sobrecarga sem argumentos; a variante (uuid) foi criada à mão em produção.
--   Um REVOKE direto sobre ela aborta `supabase db reset` / branching com
--   "function public.fn_auto_assign_ticket(uuid) does not exist".
--   As outras três existem no repo, mas foram igualmente condicionadas para
--   manter o arquivo uniforme e resistente a divergência futura.
DO $$
DECLARE
  alvo text;
BEGIN
  FOREACH alvo IN ARRAY ARRAY[
    'public.auto_close_resolved_tickets()',
    'public.update_all_tickets_sla_status()',
    'public.fn_auto_assign_ticket(uuid)',
    'public.fn_auto_assign_ticket()'
  ] LOOP
    IF to_regprocedure(alvo) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', alvo);
    ELSE
      RAISE NOTICE 'CH-C12: % não existe neste banco — revogação ignorada', alvo;
    END IF;
  END LOOP;
END $$;

-- Verificação pós-aplicação (deve devolver anon_exec = false para as quatro):
--
--   SELECT p.proname,
--          pg_get_function_identity_arguments(p.oid) AS args,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
--          has_function_privilege('postgres', p.oid, 'EXECUTE')      AS cron_exec
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('auto_close_resolved_tickets',
--                       'update_all_tickets_sla_status',
--                       'fn_auto_assign_ticket');
