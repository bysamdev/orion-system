-- =================================================================================
-- Migration: 20260825000500_fix_time_entries_cross_tenant.sql
-- Descrição: A policy "Technicians can manage own time_entries" só validava
-- user_id = auth.uid(), sem checar se o ticket_id apontado pertence à
-- própria empresa do técnico -- um técnico podia inserir/alterar
-- apontamento de horas em chamados de OUTRAS empresas. A policy de admin
-- (linha acima, não tocada aqui) já fazia essa checagem corretamente via
-- get_ticket_company_id -- aplica o mesmo padrão pra técnicos.
-- =================================================================================

DROP POLICY IF EXISTS "Technicians can manage own time_entries" ON public.time_entries;

CREATE POLICY "Technicians can manage own time_entries" ON public.time_entries FOR ALL
  TO authenticated USING (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND user_id = auth.uid()
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND user_id = auth.uid()
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  );
