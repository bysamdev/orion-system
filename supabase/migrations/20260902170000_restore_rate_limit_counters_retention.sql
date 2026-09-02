-- =================================================================================
-- Migration: 20260902170000_restore_rate_limit_counters_retention.sql
--
-- Restaura a retenção da tabela public.rate_limit_counters dentro da rotina
-- diária public.cleanup_monitoring_history() (disparada via pg_cron às 4h).
-- Essa limpeza havia sido introduzida em 20260829130000 mas foi omitida
-- inadvertidamente na redefinição da função em 20260831000000.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.cleanup_monitoring_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Alertas já resolvidos: mantém 90 dias
  DELETE FROM public.machine_alerts
  WHERE resolved = true AND created_at < now() - INTERVAL '90 days';

  -- Comandos RMM concluídos ou falhos: mantém 30 dias (nunca apaga 'pending'/'sent')
  DELETE FROM public.machine_commands
  WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '30 days';

  -- Logs de auto-remediação: mantém 90 dias
  DELETE FROM public.rmm_remediation_logs
  WHERE created_at < now() - INTERVAL '90 days';

  -- Contadores de rate limit: janelas de 1 minuto, expurgo de registros com > 1 hora
  DELETE FROM public.rate_limit_counters
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;
