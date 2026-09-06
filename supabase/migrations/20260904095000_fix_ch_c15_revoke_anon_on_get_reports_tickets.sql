-- =============================================================================
-- Migration: 20260904095000_fix_ch_c15_revoke_anon_on_get_reports_tickets.sql
--
-- Fix CH-C15 (P0): revoke anonymous access to the full cross-tenant ticket dump
--
-- APLIQUE ESTA PRIMEIRO. O timestamp foi escolhido para ordenar antes das
-- demais migrations desta auditoria.
--
-- Descrição:
--   public.get_reports_tickets existe em PRODUÇÃO e não existe em nenhuma
--   migration deste repositório (grep em supabase/migrations retorna vazio).
--   Definição lida de pg_get_functiondef:
--
--     CREATE OR REPLACE FUNCTION public.get_reports_tickets(
--       p_mode text, p_start_date timestamptz, p_end_date timestamptz,
--       p_company_id uuid DEFAULT NULL, p_tech_id uuid DEFAULT NULL)
--     RETURNS SETOF tickets
--     LANGUAGE sql SECURITY DEFINER
--     SET search_path TO 'public', 'pg_temp'
--     AS $$
--       SELECT * FROM tickets
--       WHERE (CASE p_mode ... created_at BETWEEN p_start_date AND p_end_date ... END)
--       AND (p_company_id IS NULL OR company_id = p_company_id)
--       AND (p_tech_id    IS NULL OR assigned_to_user_id = p_tech_id)
--       ORDER BY created_at DESC;
--     $$;
--
--   Combinação de fatos que torna isto um P0:
--     1. RETURNS SETOF tickets  -> devolve TODAS as colunas de cada chamado.
--     2. SECURITY DEFINER, owner postgres -> RLS não se aplica.
--     3. Nenhuma checagem de auth.uid(), is_equipe_interna(), has_role() ou
--        qualquer outra no corpo.
--     4. p_company_id tem DEFAULT NULL, e NULL desliga o filtro de empresa.
--     5. has_function_privilege('anon', oid, 'EXECUTE') = true.
--
--   Resultado: POST /rest/v1/rpc/get_reports_tickets sem nenhum token, com um
--   intervalo de datas amplo e sem p_company_id, devolve todos os chamados de
--   todos os tenants.
--
--   Contraste com public.search_tickets, que também é SECURITY DEFINER e também
--   está exposta a anon, mas tem filtro interno
--   (has_role / is_master_company_user / company_id = get_user_company_id) e por
--   isso devolve zero linhas para anon. get_reports_tickets não tem equivalente.
--
-- ESCOPO DESTA MIGRATION:
--   Apenas revogar o acesso via PostgREST. NÃO altera o corpo da função e NÃO a
--   remove, porque ela não está no repositório e não se sabe quem a chama — a
--   auditoria não encontrou chamador no frontend, no Go, nas edge functions nem
--   em cron.job, mas a ausência dela no histórico de migrations indica que foi
--   criada fora do fluxo normal, então pode haver um consumidor externo não
--   mapeado. Revogar de anon/authenticated fecha o vetor sem quebrar nada que
--   use service_role.
--
-- PRÓXIMO PASSO RECOMENDADO (fora desta migration, decisão sua):
--   Se a função for mesmo usada pela tela de Relatórios, ela precisa ganhar
--   filtro interno de tenant no mesmo padrão de search_tickets, e ser
--   versionada no repositório. Se não for usada, deve ser removida (DROP).
--   Enquanto isso não se decide, o REVOKE abaixo é a contenção.
-- =============================================================================

-- GUARDA DE REPLAY (adicionada após o diagnóstico do MIGRATIONS_FAILED):
--   Nenhuma das três funções abaixo é criada por migration alguma deste
--   repositório — todas foram criadas à mão em produção. Um `REVOKE EXECUTE`
--   direto aborta `supabase db reset` / branching com
--   "function ... does not exist". Por isso cada revogação é condicionada à
--   existência da função via to_regprocedure(), que devolve NULL em vez de
--   levantar erro quando a assinatura não existe.
--   Em produção as três existem, então o efeito é idêntico ao REVOKE direto.
--   Em banco limpo viram no-op, e o replay segue.

-- CH-C15 (P0) — dump de linhas completas.
DO $$
BEGIN
  IF to_regprocedure('public.get_reports_tickets(text, timestamptz, timestamptz, uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_reports_tickets(text, timestamptz, timestamptz, uuid, uuid) FROM anon, authenticated';
  END IF;
END $$;

-- CH-C16 (P1) — as duas irmãs da mesma família, encontradas pelo inventário
-- descrito no rodapé. Mesma estrutura: SECURITY DEFINER, owner postgres, sem
-- nenhuma checagem de auth.uid(), p_company_id com DEFAULT NULL desligando o
-- filtro de empresa, executáveis por anon.
--
-- Diferença para CH-C15: retornam json agregado, não SETOF tickets. O que vaza
-- são métricas de negócio de todos os tenants — total de chamados, abertos,
-- resolvidos, cancelados, quantidade de SLA estourado e tempo médio de
-- resolução em horas — e não o conteúdo dos chamados. Por isso P1 e não P0.
DO $$
BEGIN
  IF to_regprocedure('public.get_reports_active_in_period(timestamptz, timestamptz, uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_reports_active_in_period(timestamptz, timestamptz, uuid, uuid) FROM anon, authenticated';
  END IF;
  IF to_regprocedure('public.get_reports_created_in_period(timestamptz, timestamptz, uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_reports_created_in_period(timestamptz, timestamptz, uuid, uuid) FROM anon, authenticated';
  END IF;
END $$;

-- Verificação pós-aplicação (deve devolver anon_exec = false e auth_exec = false):
--
--   SELECT p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
--          has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc_exec
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'get_reports_tickets';
--
-- Para inventariar outras funções na mesma situação (SECURITY DEFINER, sem
-- checagem interna, executáveis por anon), somente leitura:
--
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.prosecdef
--     AND has_function_privilege('anon', p.oid, 'EXECUTE')
--     AND pg_catalog.format_type(p.prorettype, NULL) <> 'trigger'
--     AND p.prosrc NOT ILIKE '%auth.uid()%'
--   ORDER BY 1;
