-- =================================================================================
-- Migration: Retention for rate_limit_counters + centralized rate limiting
--
-- Contexto (plano de escalabilidade, Fase 9): o limitador de taxa do backend
-- era em memória por instância — o próprio código já documentava que isso
-- não funciona corretamente no Vercel serverless (várias instâncias frias
-- concorrentes, cada uma com seu próprio contador). A tabela
-- public.rate_limit_counters já existia em produção (aplicada diretamente,
-- sem migration correspondente neste repositório — mesmo padrão de drift já
-- corrigido para machine_metrics em 20260829120000), mas nenhum código a
-- usava. lib.DB.AllowDB (lib/ratelimit.go) passa a usá-la para heartbeat,
-- machine-login, commands/poll, commands/respond e self-heal-event — os
-- dois primeiros já tinham limite (em memória, agora centralizado), os
-- três últimos não tinham nenhum antes desta correção.
--
-- Esta migration só adiciona a retenção que faltava: cada bucket é uma
-- janela de 1 minuto, então nada precisa sobreviver mais que isso — 1 hora
-- de folga é suficiente para nunca apagar uma janela ainda em uso.
-- =================================================================================

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

  -- Contadores de rate limit: janelas de 1 minuto, 1h de folga já é generoso.
  DELETE FROM public.rate_limit_counters
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;
