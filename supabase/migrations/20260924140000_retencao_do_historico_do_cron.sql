-- Auditoria de espaço (docs/auditoria-espaco-supabase-2026-09-23.md): o
-- pg_cron guarda o resultado de toda execução em cron.job_run_details e
-- nada apagava. Eram 29.966 linhas (7,5 MB), 1.440 novas por dia só do
-- mark-machines-offline, que roda a cada minuto.
--
-- Decisão do Sam (23/09/2026): manter 7 dias. Um job diário às 03:15 UTC
-- (depois do cleanup-old-logs-daily das 03:00) apaga o que passou disso.
-- Mesmo método da documentação da Supabase para esse histórico.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpa-historico-do-cron') THEN
    PERFORM cron.unschedule('limpa-historico-do-cron');
  END IF;
  PERFORM cron.schedule(
    'limpa-historico-do-cron',
    '15 3 * * *',
    $job$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$job$
  );
END $$;
