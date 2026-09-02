-- Correção imediata pós-deploy dos itens 1.6/1.8: o advisor de segurança do Supabase
-- apontou que as funções novas ficaram expostas via PostgREST RPC para anon/authenticated
-- (comportamento padrão do Postgres ao criar função: EXECUTE vai para PUBLIC). Isso é
-- particularmente grave em get_cron_dispatch_secret(), que devolve o secret em texto
-- puro — qualquer chamador não autenticado conseguiria lê-lo via
-- /rest/v1/rpc/get_cron_dispatch_secret. Mesmo padrão já usado em
-- lock_down_encryption_functions para get_decrypted_remote_password: revoga de
-- PUBLIC/anon/authenticated, mantém apenas para o dono da função (postgres/service_role,
-- usado internamente pelo pg_cron e pelas próprias funções SECURITY DEFINER).

REVOKE EXECUTE ON FUNCTION public.close_contract_billing_cycles(date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_previous_month_billing_cycles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_due_report_schedules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cron_dispatch_secret() FROM PUBLIC, anon, authenticated;
