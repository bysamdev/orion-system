-- =================================================================================
-- Migration: 20260902180000_machine_metrics_history.sql
--
-- Histórico de performance (CPU/RAM/Disco) das máquinas direto no Postgres.
--
-- Até aqui o gráfico "Performance Histórica do Host" só existia via Prometheus,
-- que faz scrape PULL em local_ip:9182 de cada máquina (monitoring/bridge.mjs).
-- Isso só alcança máquina na mesma rede do servidor de monitoramento: qualquer
-- equipamento de cliente atrás de NAT ou em outro site ficava com o gráfico
-- vazio pra sempre. O heartbeat, por outro lado, já traz cpu/ram/disco de TODA
-- máquina a cada 60s — só não guardava nada, fazia UPDATE sobrescrevendo o
-- valor atual em public.machines.
--
-- Dimensionamento (meta: ~500 máquinas no plano free do Supabase, 500 MB):
--   - 1 ponto a cada 3 minutos por máquina = 480 pontos/dia (o heartbeat de 60s
--     grava no slot arredondado e os repetidos caem no ON CONFLICT DO NOTHING)
--   - retenção de 3 dias = ~720 mil linhas no pior caso
--   - percentuais em smallint em vez de bytes em bigint: 6 bytes de métrica por
--     linha em vez de 32
--   - total estimado ~70 MB com o índice da PK, ~14% do limite do plano
--
-- Particionada por dia e limpa por DROP da partição vencida, não por DELETE:
-- com esse volume, DELETE diário deixaria bloat que o autovacuum teria que
-- perseguir todo dia, e num plano free isso compete com o resto do banco.
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.machine_metrics_history (
  machine_id   uuid        NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  -- Já vem arredondado pro slot de 3 minutos (ver date_bin no backend), por
  -- isso entra na PK: o segundo heartbeat do mesmo slot não cria linha nova.
  collected_at timestamptz NOT NULL,
  cpu_pct      smallint,
  ram_pct      smallint,
  disk_pct     smallint,
  PRIMARY KEY (machine_id, collected_at)
) PARTITION BY RANGE (collected_at);

COMMENT ON TABLE public.machine_metrics_history IS
  'Série histórica de performance por máquina, um ponto a cada 3 minutos. '
  'Particionada por dia, retenção de 3 dias via maintain_machine_metrics_partitions().';

ALTER TABLE public.machine_metrics_history ENABLE ROW LEVEL SECURITY;

-- O painel lê esta tabela pela API Go (pool próprio), nunca pelo PostgREST.
-- A policy existe pra manter o padrão das demais tabelas machine_*: equipe
-- interna enxerga, cliente não.
DROP POLICY IF EXISTS "Equipe interna lê histórico de métricas" ON public.machine_metrics_history;
CREATE POLICY "Equipe interna lê histórico de métricas"
  ON public.machine_metrics_history
  FOR SELECT
  TO authenticated
  USING (public.is_equipe_interna((SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- Manutenção das partições
-- ---------------------------------------------------------------------------

-- Cria as partições de hoje e dos próximos dias e derruba as que já passaram
-- da retenção. Idempotente: pode rodar quantas vezes quiser.
--
-- Cria com 2 dias de antecedência de propósito — se o cron falhar numa noite,
-- ainda existe partição pro dia seguinte e nenhum INSERT do heartbeat é
-- perdido por falta de partição.
CREATE OR REPLACE FUNCTION public.maintain_machine_metrics_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  dia            date;
  nome_particao  text;
  particao       record;
  retencao_dias  constant int := 3;
BEGIN
  FOR dia IN
    SELECT generate_series(current_date, current_date + 2, INTERVAL '1 day')::date
  LOOP
    nome_particao := 'machine_metrics_history_' || to_char(dia, 'YYYYMMDD');
    IF to_regclass('public.' || nome_particao) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.machine_metrics_history '
        'FOR VALUES FROM (%L) TO (%L)',
        nome_particao, dia, dia + 1
      );
    END IF;
  END LOOP;

  -- Derruba partições inteiramente anteriores à janela de retenção. O nome
  -- carrega a data, então não precisamos interpretar a expressão de bounds.
  FOR particao IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    WHERE i.inhparent = 'public.machine_metrics_history'::regclass
      AND c.relname ~ '^machine_metrics_history_[0-9]{8}$'
  LOOP
    IF to_date(right(particao.relname, 8), 'YYYYMMDD') < current_date - retencao_dias THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', particao.relname);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintain_machine_metrics_partitions() FROM PUBLIC, anon, authenticated;

-- Partições iniciais pra tabela já aceitar INSERT antes do primeiro cron.
SELECT public.maintain_machine_metrics_partitions();

-- De hora em hora, não uma vez por dia: a criação antecipada só protege contra
-- falha se tiver várias chances de rodar antes da virada do dia.
SELECT cron.unschedule('maintain-machine-metrics-partitions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'maintain-machine-metrics-partitions'
);

SELECT cron.schedule(
  'maintain-machine-metrics-partitions',
  '7 * * * *',
  $cron$SELECT public.maintain_machine_metrics_partitions();$cron$
);
