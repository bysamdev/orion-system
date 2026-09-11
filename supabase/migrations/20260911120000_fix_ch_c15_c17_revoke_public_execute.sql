-- =============================================================================
-- Migration: 20260911120000_fix_ch_c15_c17_revoke_public_execute.sql
--
-- Complemento de CH-C15/CH-C16/CH-C17: revogar EXECUTE também de PUBLIC
--
-- Descrição:
--   20260904095000 e 20260904095100 revogaram EXECUTE apenas de anon e
--   authenticated. O Postgres concede EXECUTE a PUBLIC por padrão em toda
--   função nova, e anon herda esse grant via PUBLIC. Diferente de CH-C12, não
--   foi verificado que as ACLs destas funções são explícitas, então o REVOKE
--   anterior pode não ter efeito algum.
--
--   Segue o padrão já usado no repositório (ex.: 20260813130002,
--   20260902150000): REVOKE ... FROM PUBLIC, anon, authenticated.
--
--   Migration nova em vez de editar as anteriores, para funcionar tanto em
--   bancos onde aquelas já foram aplicadas quanto em replay do zero.
--   postgres (owner) e service_role mantêm EXECUTE; o cron
--   'cleanup-old-logs-daily' não é afetado.
--
-- POR QUE BUSCAR POR NOME E NÃO POR ASSINATURA:
--   20260904095000 usa to_regprocedure() com a assinatura exata. Se a função
--   em produção tiver qualquer diferença de tipo (timestamp x timestamptz,
--   parâmetro extra), to_regprocedure devolve NULL e o REVOKE vira no-op
--   silencioso — o P0 continuaria aberto. Aqui cada sobrecarga encontrada em
--   pg_proc pelo nome é revogada, qualquer que seja a assinatura. Em banco
--   limpo, onde as get_reports_* não existem, o loop simplesmente não itera.
-- =============================================================================

DO $$
DECLARE
  r record;
  total int := 0;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_reports_tickets',
                        'get_reports_active_in_period',
                        'get_reports_created_in_period',
                        'cleanup_audit_logs')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.assinatura);
    total := total + 1;
  END LOOP;

  RAISE NOTICE 'CH-C15/C17: EXECUTE revogado de PUBLIC/anon/authenticated em % função(ões)', total;
END $$;

-- Verificação pós-aplicação (anon_exec e auth_exec devem ser false em todas):
--
--   SELECT p.proname,
--          pg_get_function_identity_arguments(p.oid)                 AS args,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
--          has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc_exec
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('get_reports_tickets', 'get_reports_active_in_period',
--                       'get_reports_created_in_period', 'cleanup_audit_logs');
