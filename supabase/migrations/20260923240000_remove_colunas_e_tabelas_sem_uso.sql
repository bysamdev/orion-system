-- Limpeza depois do deploy das decisões de 23/09/2026 (cards no Notion).
-- O código que usava cada item saiu nos commits anteriores e já está em
-- produção; aqui sai o que ficou no banco.

-- Base de conhecimento: a categoria agora é knowledge_base_articles.category,
-- com a mesma lista dos chamados (20260923230000). category_id apontava para
-- a tabela categories, que não existe mais.
DROP INDEX IF EXISTS public.idx_knowledge_base_articles_category_id;
ALTER TABLE public.knowledge_base_articles DROP COLUMN IF EXISTS category_id;

-- UptimeRobot (ORN-DUP-04): a integração saiu; o status dos sites vem só do
-- Blackbox, pelo orion-bridge.
ALTER TABLE public.monitored_endpoints DROP COLUMN IF EXISTS uptimerobot_monitor_id;

-- network_links (ORN-DUP-05): ficam só as colunas canônicas que o
-- orion-bridge lê e grava (link_type, ip_or_hostname, last_ping_ms,
-- last_checked_at). A tabela não tinha nenhuma linha.
ALTER TABLE public.network_links
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS ip_or_host,
  DROP COLUMN IF EXISTS latency_ms,
  DROP COLUMN IF EXISTS last_check;

-- Telemetria antiga no Supabase (ORN-DB-06): a série do gráfico mora no
-- Orion Monitor. Saem o cron que criava partição de hora em hora, a função
-- dele e a tabela particionada (vazia), com as partições.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'maintain-machine-metrics-partitions') THEN
    PERFORM cron.unschedule('maintain-machine-metrics-partitions');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.maintain_machine_metrics_partitions();
DROP TABLE IF EXISTS public.machine_metrics_history CASCADE;
