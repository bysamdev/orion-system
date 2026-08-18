-- cleanup_old_machine_metrics() é SECURITY DEFINER sem search_path fixo
-- (proconfig nulo, confirmado) — mesma classe de vulnerabilidade
-- (sequestro de search_path) corrigida nas outras funções SECURITY DEFINER
-- desta sessão. Além disso estava com EXECUTE liberado para anon/authenticated
-- por default do Postgres, sem necessidade: é chamada só pelo pg_cron
-- (job "cleanup-old-machine-metrics-daily", roda como o papel "postgres",
-- que mantém EXECUTE), nunca via API/RPC.
ALTER FUNCTION public.cleanup_old_machine_metrics() SET search_path = 'public', 'pg_temp';
REVOKE EXECUTE ON FUNCTION public.cleanup_old_machine_metrics() FROM PUBLIC, anon, authenticated;
