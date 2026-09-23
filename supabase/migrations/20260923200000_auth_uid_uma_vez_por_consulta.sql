-- Opção 2 do pós-auditoria (lint 0003 auth_rls_initplan do advisor): 22
-- policies chamavam auth.uid() direto, e o Postgres reavalia a chamada a cada
-- linha. Com (SELECT auth.uid()) ela vira um initplan, avaliado uma vez por
-- consulta.
--
-- Só isso rendeu pouco (audit_log de ~410 para ~355 ms): o custo real estava
-- nas funções auxiliares (has_role, is_master_company_user, is_equipe_interna,
-- get_user_company_id), também chamadas por linha. Como os argumentos delas
-- são só o usuário logado e um papel fixo, o resultado é o mesmo em todas as
-- linhas da consulta, e também podem virar initplan com (SELECT ...).
--
-- A regra de acesso não muda: só quantas vezes cada parte é calculada.
--
-- Medido em 23/09/2026 em produção, média de 5 count(*), antes -> depois:
--   audit_log (admin mãe, cliente, técnico)  ~405 ms -> ~190 ms
--   ticket_updates (admin mãe, técnico)      ~4 ms   -> ~1,5 ms
-- Contagem de linhas visíveis idêntica antes e depois para cliente, técnico,
-- admin da empresa mãe e desenvolvedor em audit_log, tickets, profiles,
-- ticket_updates, ticket_attachments, machines, notifications, time_entries
-- e nas 13 tabelas das 22 policies.
--
-- Em vez de reescrever policy por policy, percorre as que usam auth.uid() e
-- troca só essas chamadas; o resto da expressão é o texto que o próprio
-- Postgres devolve (pg_policies).

DO $$
DECLARE
  p record;
  marca constant text := '@@UID@@';
  -- Chamada de auxiliar com o usuário logado (e papel fixo) ainda sem SELECT.
  auxiliar constant text := '(?<!SELECT )\m(has_role|is_master_company_user|is_equipe_interna|get_user_company_id)\(\(SELECT auth\.uid\(\)\)(, ''[a-z]+''::app_role)?\)';
  v_qual text;
  v_check text;
  sql text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\.uid\(\)'
  LOOP
    v_qual := p.qual;
    v_check := p.with_check;

    -- Protege as chamadas já embrulhadas, troca as soltas, restaura e depois
    -- embrulha as auxiliares.
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, '\( SELECT auth\.uid\(\) AS uid\)', marca, 'g');
      v_qual := replace(v_qual, 'auth.uid()', '(SELECT auth.uid())');
      v_qual := replace(v_qual, marca, '(SELECT auth.uid())');
      v_qual := regexp_replace(v_qual, auxiliar, '(SELECT \&)', 'g');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, '\( SELECT auth\.uid\(\) AS uid\)', marca, 'g');
      v_check := replace(v_check, 'auth.uid()', '(SELECT auth.uid())');
      v_check := replace(v_check, marca, '(SELECT auth.uid())');
      v_check := regexp_replace(v_check, auxiliar, '(SELECT \&)', 'g');
    END IF;

    IF v_qual IS NOT DISTINCT FROM p.qual AND v_check IS NOT DISTINCT FROM p.with_check THEN
      CONTINUE;
    END IF;

    sql := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF v_qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', v_qual);
    END IF;
    IF v_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;
