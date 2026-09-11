-- =================================================================================
-- Migration: 20260911170000_revoga_execute_indevido_e_indice_duplicado.sql
--
-- Auditoria de banco de 2026-09-11, achado P1: o papel `anon` tinha EXECUTE em
-- 49 funções SECURITY DEFINER. A chave anon de um projeto Supabase é pública
-- por design, então qualquer pessoa na internet podia chamá-las.
--
-- A contagem de 49 mistura três grupos com risco muito diferente, e esta
-- migration trata só os dois que são comprovadamente seguros de revogar. O
-- terceiro fica documentado no fim, porque revogá-lo agora QUEBRARIA a
-- aplicação — ver a justificativa e o teste que mostra isso.
--
-- Grupo 1 — 35 funções de trigger. Nunca deveriam ser chamáveis por ninguém.
-- Verificado empiricamente que revogar não quebra nada: o disparo de trigger
-- não checa EXECUTE do usuário que fez o INSERT/UPDATE (testado revogando
-- set_ticket_update_author e inserindo em ticket_updates como authenticated —
-- o INSERT funcionou normalmente).
--
-- Grupo 2 — 8 funções realmente chamáveis via PostgREST. Duas delas APAGAM
-- dados (cleanup_expired_invite_tokens, cleanup_monitoring_history) e eram
-- acionáveis sem autenticação nenhuma; esse era o risco concreto do achado.
-- =================================================================================

-- ---------------------------------------------------------------------------
-- Grupo 1: funções de trigger
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.assinatura);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Grupo 2a: destrutivas e de introspecção — ninguém da aplicação chama.
--
-- cleanup_* rodam pelo pg_cron como postgres, que é owner e não depende de
-- GRANT. check_* não têm chamador nenhum (nem app, nem cron) e só expõem
-- nomes de tabelas, tamanhos e estatísticas.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.cleanup_expired_invite_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_monitoring_history()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_index_health()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_table_bloat()              FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grupo 2b: RPCs legítimas da aplicação — tira anon, mantém authenticated.
--
-- get_company_plan_usage é chamada por src/hooks/usePlanUsage.ts e
-- count_company_active_agents por src/hooks/useMyTickets.ts, ambas com sessão
-- de usuário. get_dashboard_stats e search_tickets não têm chamador hoje, mas
-- são RPCs de produto com checagem interna por auth.uid(); mantidas para
-- authenticated em vez de removidas.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_company_plan_usage()              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.count_company_active_agents(uuid)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_stats()                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_tickets(text)                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_company_plan_usage()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_company_active_agents(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_tickets(text)               TO authenticated;

-- ---------------------------------------------------------------------------
-- Índice duplicado em tickets (achado P2 da mesma auditoria).
--
-- idx_tickets_assigned_to_user_id e idx_tickets_assigned_user_id têm
-- definição byte a byte idêntica sobre assigned_to_user_id. O planner usa um
-- só: 14.094 leituras contra 0. Nenhum dos dois sustenta constraint.
--
-- DROP simples, sem CONCURRENTLY: a tabela tem poucas dezenas de linhas, o
-- lock é instantâneo, e CONCURRENTLY não pode rodar dentro da transação da
-- migration.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_tickets_assigned_to_user_id;

-- =================================================================================
-- Grupo 3 — NÃO revogado de propósito: as auxiliares de RLS.
--
-- has_role, get_user_company_id, get_ticket_company_id, is_equipe_interna,
-- is_master_company_user e ticket_belongs_to_user_company aparecem em até 148
-- políticas, muitas declaradas TO public — que inclui anon. Políticas são
-- avaliadas com os privilégios de quem consulta, então sem EXECUTE a
-- avaliação falha em vez de negar.
--
-- Medido antes de decidir, em transação revertida:
--
--   anon SELECT em tickets, hoje ............. 0 linhas (negação silenciosa)
--   idem, após revogar has_role de anon ...... ERRO 42501: permission denied
--                                              for function has_role
--
-- Numa SPA Supabase, consulta disparada enquanto a sessão ainda está sendo
-- restaurada usa a chave anon: isso viraria erro na tela em vez de lista
-- vazia. A ordem correta é primeiro declarar as políticas como
-- TO authenticated (achado P2 "políticas permissivas sobrepostas"), o que
-- tira anon da avaliação, e só então revogar estas funções. Fazer o inverso,
-- como a ordem sugerida na auditoria, quebra a aplicação.
-- =================================================================================
