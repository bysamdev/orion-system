-- Correções de performance (INFO, não bloqueantes) apontadas pelo advisor logo após o
-- deploy dos itens 1.6/1.8: índice cobrindo FK que faltava em cada tabela nova, e RLS
-- init-plan (mesmo padrão já aplicado ao resto do projeto em
-- wrap_rls_auth_calls_initplan) para contract_billing_cycles e report_schedules.

CREATE INDEX IF NOT EXISTS idx_contract_billing_cycles_company ON public.contract_billing_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_created_by ON public.report_schedules(created_by);

DROP POLICY IF EXISTS "Usuarios podem ver ciclos de fechamento da empresa" ON public.contract_billing_cycles;
CREATE POLICY "Usuarios podem ver ciclos de fechamento da empresa"
ON public.contract_billing_cycles
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id((select auth.uid()))
  OR is_equipe_interna((select auth.uid()))
);

DROP POLICY IF EXISTS "Equipe interna gerencia agendamentos de relatorio" ON public.report_schedules;
CREATE POLICY "Equipe interna gerencia agendamentos de relatorio"
ON public.report_schedules
FOR ALL
TO authenticated
USING (is_equipe_interna((select auth.uid())))
WITH CHECK (is_equipe_interna((select auth.uid())));
