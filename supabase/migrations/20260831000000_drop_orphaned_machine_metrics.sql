-- =================================================================================
-- Migration: Remove a tabela machine_metrics órfã, preserva a retenção do resto
--
-- Contexto: a migration 20260829120000 recriou machine_metrics (histórico de
-- CPU/RAM/disco) para o HeartbeatUpsert desta sessão gravar nela — decisão
-- tomada sem visibilidade de que, em paralelo, main já havia migrado esse
-- mesmo histórico para Prometheus/Grafana (commits c6cbe2c/9612b7f, ver
-- ESCALABILIDADE.md §5) e removido machine_metrics de propósito. No merge, a
-- reconciliação manteve a arquitetura do main (UpdateMachineSnapshot, sem
-- histórico em Postgres) e descartou HeartbeatUpsert — mas a tabela recriada
-- em produção ficou pra trás, órfã: nenhum código grava ou lê dela mais.
--
-- Não é um DROP TABLE isolado: 20260829120000 também criou
-- cleanup_monitoring_history(), que via pg_cron ('cleanup-monitoring-history-
-- daily', todo dia às 4h) limpa machine_metrics MAS TAMBÉM machine_alerts
-- resolvidos, machine_commands concluídos/falhos e rmm_remediation_logs —
-- retenção que não existia antes e continua necessária. Um DROP TABLE sem
-- atualizar a função quebraria essa rotina inteira todo dia (erro ao tentar
-- limpar uma tabela que não existe mais), levando junto a retenção dos três
-- outros que não têm nenhuma relação com este cleanup.
-- =================================================================================

-- 1. Redefine a função SEM o bloco de machine_metrics, mantendo os outros três.
CREATE OR REPLACE FUNCTION public.cleanup_monitoring_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Alertas já resolvidos: mantém 90 dias (mesmo horizonte do audit_log)
  -- para suporte/auditoria; alertas em aberto nunca são tocados aqui.
  DELETE FROM public.machine_alerts
  WHERE resolved = true AND created_at < now() - INTERVAL '90 days';

  -- Comandos RMM concluídos ou falhos: 30 dias é suficiente para
  -- investigar um comando problemático; nunca apaga 'pending'/'sent'.
  DELETE FROM public.machine_commands
  WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '30 days';

  -- Logs de auto-remediação: mesmo horizonte de 90 dias do audit_log.
  DELETE FROM public.rmm_remediation_logs
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$;

-- 2. Remove a tabela órfã (CASCADE cuida de índice, políticas RLS e da FK de
-- machine_id — nada mais referencia machine_metrics).
DROP TABLE IF EXISTS public.machine_metrics CASCADE;
