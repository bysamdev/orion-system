-- =================================================================================
-- Migration: 20260903010000_egress_diario.sql
--
-- Acumulador diário de bytes servidos pela API do Orion, usado como estimativa
-- do egress consumido no Supabase.
--
-- Por que estimar em vez de ler o número oficial: a Management API pública do
-- Supabase (api.supabase.com/v1) expõe organizations, projects, members e
-- webhooks — não expõe usage nem egress. O valor que aparece no painel de
-- billing vem de uma API interna, sem contrato de estabilidade. Um alerta que
-- protege o lançamento não pode depender de um endpoint que muda sem aviso.
--
-- O que esta contagem mede: os bytes que a API do Orion devolve aos clientes.
-- Quase todo egress do projeto Supabase passa por aqui, porque o backend lê do
-- Postgres pelo pooler e repassa ao navegador — a listagem de máquinas, que é
-- a maior fatia, sai praticamente do mesmo tamanho que entrou. Fica de fora o
-- que o frontend busca direto do Supabase (sessão de auth e Storage), então o
-- número real é um pouco maior que o medido aqui; o alerta em 80% existe
-- justamente pra absorver essa diferença.
--
-- Uma linha por dia, incrementada com upsert. Retenção de 90 dias na rotina
-- diária de limpeza — é histórico de capacidade, não dado operacional.
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.egress_diario (
  dia   date   NOT NULL PRIMARY KEY,
  bytes bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.egress_diario IS
  'Bytes servidos pela API do Orion por dia. Estimativa do egress do projeto Supabase — ver comentário da migração 20260903010000.';

ALTER TABLE public.egress_diario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.egress_diario FROM PUBLIC, anon, authenticated;

-- Incremento atômico: várias instâncias serverless somam no mesmo dia sem
-- corrida e sem precisar ler antes de escrever.
CREATE OR REPLACE FUNCTION public.somar_egress(p_bytes bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.egress_diario (dia, bytes)
  VALUES (current_date, p_bytes)
  ON CONFLICT (dia) DO UPDATE SET bytes = public.egress_diario.bytes + EXCLUDED.bytes;
$$;

REVOKE ALL ON FUNCTION public.somar_egress(bigint) FROM PUBLIC, anon, authenticated;

-- Retenção de 90 dias na rotina diária já existente. É uma linha por dia,
-- então o volume é irrisório — a limpeza existe só pra tabela não crescer
-- indefinidamente.
CREATE OR REPLACE FUNCTION public.cleanup_monitoring_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.machine_alerts
  WHERE resolved = true AND created_at < now() - INTERVAL '90 days';

  DELETE FROM public.machine_commands
  WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '30 days';

  DELETE FROM public.rmm_remediation_logs
  WHERE created_at < now() - INTERVAL '90 days';

  DELETE FROM public.rate_limit_counters
  WHERE window_start < now() - INTERVAL '1 hour';

  DELETE FROM public.egress_diario
  WHERE dia < current_date - 90;
END;
$$;
