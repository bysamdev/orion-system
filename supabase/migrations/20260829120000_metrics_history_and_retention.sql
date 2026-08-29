-- =================================================================================
-- Migration: Metrics history table + retention for monitoring tables
--
-- Contexto (auditoria de escalabilidade, 2026-08-29): a tabela machine_metrics
-- havia sido removida diretamente em produção (migration não versionada neste
-- repositório) em favor de colunas de snapshot em public.machines
-- (cpu_usage, ram_total, ram_used, disk_total, disk_used, uptime,
-- metrics_collected_at — já existentes ao vivo, adicionadas por uma migration
-- também não versionada aqui). O código Go deste checkout ainda dependia da
-- tabela removida (lib/monitoring.go: InsertMetric, MachinesByGroupID,
-- CriticalAlerts), então todo heartbeat estava falhando com erro de SQL antes
-- de conseguir atualizar status/alertas.
--
-- Esta migration recria machine_metrics como histórico legítimo (usado pelo
-- gráfico de tendência por máquina, useMachineMetrics/PerformanceChart.tsx),
-- mas — ao contrário da tabela original, que crescia sem limite — com
-- retenção de 7 dias via pg_cron, para não reintroduzir o problema de
-- "Postgres como banco de série temporal" que a remoção original pretendia
-- resolver. O código Go passa a gravar tanto o snapshot em machines (estado
-- atual, já usado por list/dashboard) quanto uma linha de histórico aqui,
-- na mesma transação.
--
-- Também cobre a segunda correção de baixo risco já aprovada no plano de
-- escalabilidade: retenção para machine_alerts/machine_commands/
-- rmm_remediation_logs (hoje sem nenhuma limpeza agendada) e os índices que
-- faltavam nas duas tabelas de maior escrita.
-- =================================================================================

-- ---------------------------------------------------------------------------
-- 1. Recriar machine_metrics (histórico, com retenção — ver função abaixo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machine_metrics (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  cpu_usage    FLOAT8,
  ram_total    BIGINT,
  ram_used     BIGINT,
  disk_total   BIGINT,
  disk_used    BIGINT,
  uptime       BIGINT,
  collected_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Composto único (machine_id, collected_at DESC) cobre tanto "última leitura
-- de uma máquina" (LIMIT 1) quanto "histórico de uma máquina" (LIMIT N) sem
-- precisar de um índice separado por collected_at — a migration original
-- (20260310192900) criava os dois e uma correção posterior
-- (20260614000005_drop_conflicting_metrics_index) já teve que remover o
-- índice solto por atrapalhar o planner num LATERAL JOIN; não recriamos essa
-- combinação.
CREATE INDEX IF NOT EXISTS idx_machine_metrics_machine_collected
  ON public.machine_metrics (machine_id, collected_at DESC);

ALTER TABLE public.machine_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company machine_metrics" ON public.machine_metrics FOR SELECT USING (
  machine_id IN (SELECT id FROM public.machines WHERE company_id = get_user_company_id(auth.uid()))
  OR is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machine_metrics" ON public.machine_metrics FOR INSERT WITH CHECK (
  machine_id IN (SELECT id FROM public.machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete company machine_metrics" ON public.machine_metrics FOR DELETE USING (
  machine_id IN (SELECT id FROM public.machines WHERE company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- ---------------------------------------------------------------------------
-- 2. Índices que faltavam nas duas tabelas de monitoramento com mais escrita
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_machine_alerts_created_at
  ON public.machine_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_machine_commands_machine_created
  ON public.machine_commands (machine_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Retenção agendada (pg_cron já está habilitado — ver 20260614000000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_monitoring_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Série temporal de métricas: 7 dias é o suficiente para o gráfico de
  -- tendência por máquina; não é dado de produto de longo prazo.
  DELETE FROM public.machine_metrics
  WHERE collected_at < now() - INTERVAL '7 days';

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

SELECT cron.schedule(
  'cleanup-monitoring-history-daily',
  '0 4 * * *',
  $$SELECT public.cleanup_monitoring_history()$$
);
