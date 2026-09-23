-- Alinha o banco recriado do zero (CI) com produção.
--
-- Estas funções e gatilhos são criados por migrations antigas, mas foram
-- removidos direto no banco de produção, sem migration. No replay do zero da
-- CI eles continuam existindo e quebram os testes: tr_auto_resume_sla_on_reply,
-- por exemplo, lê profiles.role, coluna que não existe mais.
--
-- Conferido em 23/09/2026: nenhum destes 28 nomes existe em produção
-- (pg_proc e pg_trigger). Em produção esta migration não faz nada.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname, t.tgrelid::regclass AS tabela
      FROM pg_trigger t
     WHERE NOT t.tgisinternal
       AND t.tgname IN (
         'validate_assignment_on_ticket_update', 'trg_validate_category_parent',
         'tr_deduct_contract_ticket', 'validate_company_name',
         'tr_auto_resume_on_customer_reply_trigger', 'set_author_on_ticket_update_insert',
         'audit_user_roles_trigger', 'validate_ticket_before_insert_update',
         'audit_profiles_trigger', 'update_departments_updated_at',
         'tr_auto_response_ticket', 'tr_auto_resume_sla_on_reply_trigger',
         'encrypt_remote_password_on_tickets', 'audit_tickets_trigger',
         'validate_assignment_before_update', 'tr_log_automation',
         'validate_profile_before_insert_update', 'validate_company_before_insert_update',
         'tr_auto_assign_ticket_fallback')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.tabela);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS funcao
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN (
         'fn_auto_response_ticket', 'fn_deduct_contract_ticket', 'fn_log_automation_results',
         'fn_sla_escalation_monitor', 'generate_api_key', 'get_backup_codes_status',
         'save_user_backup_codes', 'tr_auto_resume_sla_on_reply', 'verify_user_backup_code')
  LOOP
    -- CASCADE leva junto gatilhos de outro nome que usem a função; como a
    -- função não existe em produção, nada que dependa dela existe lá.
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.funcao);
  END LOOP;

  -- Em produção routing_rules e automation_logs têm uma policy cada, as do
  -- motor de automações (20260919040000). No replay sobram policies antigas
  -- de outro nome que deixam o técnico ver regras e histórico.
  FOR r IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('routing_rules', 'automation_logs')
       AND policyname NOT IN ('Gestores gerem regras de automacao',
                              'Gestores veem historico de automacao')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
