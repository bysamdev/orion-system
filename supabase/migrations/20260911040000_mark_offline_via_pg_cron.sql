-- =================================================================================
-- Migration: 20260911040000_mark_offline_via_pg_cron.sql
--
-- Achado ORI-P1-03 (auditoria 2026-09-11): a cadência de marcação de máquina
-- offline não correspondia à promessa do produto.
--
-- public.silencio_tolerado(device_type) define 3 minutos para 'server' e 12
-- minutos para o resto — mas o único chamador de MarkOfflineMachines era o
-- cron da Vercel em /api/monitoring/cron/mark-offline, agendado '0 0 * * *'
-- (uma vez por dia) no vercel.json. O comentário do handler em
-- handler/router.go ainda dizia "every 5 minutes", que nunca foi verdade no
-- arquivo de configuração. O worker em goroutine (startNetworkPingWorker) não
-- cobria essa lacuna: ele só chama ProbeAllNetworkLinks, nunca
-- MarkOfflineMachines.
--
-- Efeito prático: um servidor que caísse logo depois da execução diária
-- permanecia com status 'online' no painel por até 24 horas, contra os 3
-- minutos que o próprio banco declara tolerar.
--
-- Correção: mover para pg_cron, que já é o scheduler durável deste projeto
-- (7 jobs ativos, incluindo sla-status-recalc a cada 15 minutos — cadência
-- sub-horária é suportada neste plano). A operação é UPDATE puro, sem
-- nenhuma dependência de rede ou de storage, então não há razão para
-- depender de uma instância serverless estar viva para executá-la.
--
-- Cadência de 1 minuto: com tolerância de 3 minutos para servidor, a
-- detecção fica entre 3 e 4 minutos, que torna a promessa honesta. O UPDATE
-- é filtrado por status <> 'offline', então em regime normal não toca linha
-- nenhuma.
-- =================================================================================

-- Espelha MarkOfflineMachines (lib/monitoring.go). A função passa a ser a
-- fonte única desta regra: o endpoint HTTP em handler/router.go continua
-- existindo para acionamento manual, mas o agendamento vive aqui.
CREATE OR REPLACE FUNCTION public.marcar_maquinas_offline()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_marcadas integer;
BEGIN
  UPDATE public.machines
  SET status = 'offline'
  WHERE status <> 'offline'
    AND last_seen < now() - public.silencio_tolerado(device_type);

  GET DIAGNOSTICS v_marcadas = ROW_COUNT;
  RETURN v_marcadas;
END;
$$;

-- Só o pg_cron (postgres) e o pool privilegiado da API precisam disto.
-- Mesmo padrão das RPCs do bridge depois de
-- 20260910190000_revoke_anon_bridge_rpc_grants.sql: nada de EXECUTE para
-- anon/authenticated, já que nenhum caminho do frontend chama esta função.
REVOKE ALL ON FUNCTION public.marcar_maquinas_offline() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_maquinas_offline() FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mark-machines-offline')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-machines-offline');

    PERFORM cron.schedule(
      'mark-machines-offline',
      '* * * * *',
      'SELECT public.marcar_maquinas_offline()'
    );
  END IF;
END;
$$;
