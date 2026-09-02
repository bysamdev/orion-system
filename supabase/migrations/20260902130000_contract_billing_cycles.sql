-- Item 1.6 (acabamento MVP): fecha o ciclo de banco de horas.
-- TimeTracker.tsx já grava apontamentos em time_entries e contracts.monthly_hours já
-- existe como meta contratada, mas não havia consolidação mensal nem comparação
-- consumido x contratado. Mudança puramente aditiva: uma tabela nova
-- (contract_billing_cycles) e uma função de fechamento agendada via cron — nenhuma
-- coluna existente muda de tipo/obrigatoriedade, nenhuma policy existente é alterada.
--
-- Fechamento automático (decisão do usuário): roda no dia 1 de cada mês e consolida
-- o mês anterior. Não há backfill de meses anteriores a esta migração nem trava de
-- apontamentos retroativos — não foram pedidos e ficam fora deste escopo cirúrgico.

CREATE TABLE public.contract_billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  contracted_hours numeric,
  consumed_hours numeric NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, period_start)
);

CREATE INDEX idx_contract_billing_cycles_contract ON public.contract_billing_cycles(contract_id, period_start DESC);

ALTER TABLE public.contract_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão unificado já usado em contracts/sla_configs (20260901220000_fix_p0_authorization_and_rls.sql):
-- equipe interna vê tudo, cliente vê apenas a própria empresa. Somente leitura via
-- PostgREST — o fechamento em si é gravado pela função SECURITY DEFINER abaixo.
CREATE POLICY "Usuarios podem ver ciclos de fechamento da empresa"
ON public.contract_billing_cycles
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR is_equipe_interna(auth.uid())
);

-- Fecha um período [p_period_start, p_period_end] para todos os contratos ativos:
-- soma as horas faturáveis apontadas em time_entries (via ticket -> empresa) e
-- compara com contracts.monthly_hours na data do fechamento. Idempotente por
-- (contract_id, period_start) via ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.close_contract_billing_cycles(p_period_start date, p_period_end date)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count INTEGER := 0;
BEGIN
  INSERT INTO contract_billing_cycles (contract_id, company_id, period_start, period_end, contracted_hours, consumed_hours)
  SELECT
    c.id,
    c.company_id,
    p_period_start,
    p_period_end,
    c.monthly_hours,
    COALESCE(SUM(te.duration_minutes), 0) / 60.0
  FROM contracts c
  LEFT JOIN tickets t ON t.company_id = c.company_id
  LEFT JOIN time_entries te ON te.ticket_id = t.id
    AND te.billable = true
    AND te.start_time >= p_period_start
    AND te.start_time < (p_period_end + 1)
  WHERE c.is_active = true
  GROUP BY c.id, c.company_id
  ON CONFLICT (contract_id, period_start) DO NOTHING;

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

-- Wrapper que resolve "o mês anterior" a partir da data atual, para o cron mensal.
CREATE OR REPLACE FUNCTION public.close_previous_month_billing_cycles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.close_contract_billing_cycles(
    (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date,
    (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date
  );
END;
$$;

-- Roda às 04:00 (UTC) do dia 1 de cada mês, consolidando o mês anterior.
SELECT cron.schedule(
  'close-monthly-billing-cycles',
  '0 4 1 * *',
  $$SELECT public.close_previous_month_billing_cycles()$$
);
