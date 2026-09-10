-- =================================================================================
-- Migration: 20260910170000_fix_machine_metrics_partitions_rls.sql
--
-- machine_metrics_history (migração 20260902180000) habilita RLS e cria a
-- policy "Equipe interna lê histórico de métricas" na tabela-mãe, mas
-- relrowsecurity é atributo por-relação: CREATE TABLE ... PARTITION OF NÃO
-- copia esse flag pra partição nova. maintain_machine_metrics_partitions()
-- cria uma partição por dia sem ligar RLS nela — confirmado ao vivo: as 6
-- partições existentes (_20260907 a _20260912) estão com relrowsecurity =
-- false. Como o PostgREST expõe cada tabela do schema public como endpoint
-- próprio, isso vira REST anônimo/autenticado sem filtro de linha em cima de
-- telemetria de CPU/RAM/disco por máquina/cliente — achado ERROR do linter
-- de segurança do Supabase (rls_disabled_in_public), mesma classe do CH-C15.
--
-- A policy em si não precisa ser recriada em cada partição: policy definida
-- na tabela particionada é herdada pelas partições automaticamente. Falta
-- só ligar a flag. Sem isso o buraco se reabre sozinho a cada dia, porque o
-- cron cria uma partição nova toda hora (`maintain-machine-metrics-partitions`).
-- =================================================================================

-- Fecha o buraco nas partições que já existem.
DO $$
DECLARE
  particao record;
BEGIN
  FOR particao IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    WHERE i.inhparent = 'public.machine_metrics_history'::regclass
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', particao.relname);
  END LOOP;
END;
$$;

-- Corrige a função de manutenção pra toda partição nascer com RLS ligada.
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
      -- relrowsecurity não é copiado de CREATE TABLE ... PARTITION OF — sem
      -- esta linha a partição nasce exposta via PostgREST sem o filtro de
      -- linha que a tabela-mãe tem (ver cabeçalho desta migração). A policy
      -- da tabela-mãe é herdada automaticamente; só falta ligar a flag.
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nome_particao);
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

-- Roda uma vez agora pra garantir que a partição de hoje (e as 2 seguintes)
-- já nascem corretas, sem esperar o próximo disparo do cron.
SELECT public.maintain_machine_metrics_partitions();
