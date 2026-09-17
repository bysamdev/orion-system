-- =============================================================================
-- A poda do histórico de métricas sai do heartbeat e vira tarefa horária
-- =============================================================================
--
-- O DESPERDÍCIO
--
-- AppendMetricPoint (lib/monitoring.go) fazia DUAS idas ao banco por
-- heartbeat de máquina que não é servidor:
--
--   1. INSERT do ponto da série, com ON CONFLICT DO NOTHING;
--   2. DELETE das linhas daquela máquina com mais de 24h.
--
-- O segundo é quase sempre trabalho jogado fora. Ele só tem o que apagar
-- quando a máquina cruza a fronteira das 24h de histórico — nas outras vezes
-- percorre o índice, não acha nada e volta. Como estação de trabalho manda
-- heartbeat a cada 300s (collectionIntervalSeconds), são 288 DELETE por dia
-- por máquina. Nas ~500 máquinas previstas, 144 mil comandos por dia para
-- apagar o que caberia numa varredura só.
--
-- Não era um erro: o comentário original justificava a escolha como o
-- equivalente por-linha do DROP de partição que já existe para servidor,
-- evitando de propósito um DELETE em massa. O raciocínio está certo sobre
-- DELETE em massa; o que passou batido é que a alternativa não precisa ser
-- por heartbeat — pode ser por hora.
--
-- A MUDANÇA
--
-- A poda passa para maintain_machine_metrics_partitions, que já roda de hora
-- em hora e já é a dona da retenção desta tabela: é ela que cria as partições
-- do dia e derruba as vencidas. Juntar as duas retenções na mesma função
-- deixa um lugar só para entender por quanto tempo o histórico vive.
--
-- Contagem de comandos por dia, com 500 máquinas:
--
--   antes:  144.000 DELETE (um por heartbeat, por máquina)
--   depois:      24 DELETE (um por hora, cobrindo a frota inteira)
--
-- O CUSTO, DECLARADO
--
-- A janela de retenção de estação de trabalho deixa de ser exatamente 24h e
-- passa a ser "24h até a próxima execução horária", ou seja, no máximo 25h.
-- Uma hora a mais de dado numa retenção de 24h é troca barata por eliminar
-- 99,98% dos comandos.
--
-- O filtro por collected_at vem primeiro de propósito: ele deixa o Postgres
-- descartar as partições de hoje e de ontem inteiras antes de olhar linha
-- alguma, que é justamente o que a tabela particionada oferece.
--
-- device_type nulo continua contando como não-servidor, igual ao
-- `deviceType != "server"` que existia no Go — a retenção longa é privilégio
-- de quem foi explicitamente classificado como servidor.
--
-- NÃO ALTERA DADOS além da poda que já acontecia por outro caminho.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maintain_machine_metrics_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  dia date;
  nome_particao text;
  particao record;
  retencao_dias constant int := 3;
  retencao_estacao constant interval := interval '24 hours';
BEGIN
  -- Partições de hoje e dos dois próximos dias.
  FOR dia IN SELECT generate_series(current_date, current_date + 2, INTERVAL '1 day')::date LOOP
    nome_particao := 'machine_metrics_history_' || to_char(dia, 'YYYYMMDD');
    IF to_regclass('public.' || nome_particao) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.machine_metrics_history '
        'FOR VALUES FROM (%L) TO (%L)',
        nome_particao, dia, dia + 1
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nome_particao);
    END IF;
  END LOOP;

  -- Retenção longa (servidor): DROP da partição vencida, que é o expurgo
  -- barato pelo qual a tabela foi particionada.
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

  -- Retenção curta (estação de trabalho): uma varredura por hora, no lugar de
  -- um DELETE por heartbeat por máquina.
  DELETE FROM public.machine_metrics_history h
   USING public.machines m
   WHERE h.collected_at < now() - retencao_estacao
     AND m.id = h.machine_id
     AND COALESCE(m.device_type, '') <> 'server';
END;
$$;

COMMENT ON FUNCTION public.maintain_machine_metrics_partitions() IS
  'Dona da retenção de machine_metrics_history: cria as partições do dia, '
  'derruba as com mais de 3 dias (retenção de servidor) e apara para 24h o '
  'histórico de quem não é servidor. Roda de hora em hora.';
