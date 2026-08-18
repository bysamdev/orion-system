-- Migration: Cleanup and retention policy for telemetry metrics and remote commands
-- Created: 2026-08-18

CREATE OR REPLACE FUNCTION public.cleanup_old_machine_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove metricas de hardware com mais de 7 dias (Prometheus mantem 30 dias na TSDB)
    DELETE FROM public.machine_metrics
    WHERE collected_at < (NOW() - INTERVAL '7 days');

    -- Remove comandos remotos completados/falhos com mais de 30 dias
    DELETE FROM public.machine_commands
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < (NOW() - INTERVAL '30 days');
END;
$$;

-- Agendamento diario no pg_cron as 03:30 AM
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('cleanup-old-machine-metrics-daily')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-machine-metrics-daily');

        PERFORM cron.schedule(
            'cleanup-old-machine-metrics-daily',
            '30 3 * * *',
            'SELECT public.cleanup_old_machine_metrics()'
        );
    END IF;
END $$;
