-- =============================================================================
-- Migration: 20260901230000_fix_time_entries_customer_visibility.sql
--
-- Descrição: time_entries tinha uma policy antiga não tocada pela
-- unificação de 20260901220000 -- "Company users can view company
-- time_entries" deixava QUALQUER usuário autenticado da empresa, inclusive
-- customer, ler o apontamento de horas dos técnicos (dado interno de
-- billing/produtividade, não deveria ser visível pro cliente final).
--
-- A policy nova exige que o leitor seja staff (admin/technician/developer)
-- da própria empresa OU equipe interna (MSP-wide) -- mesmo padrão de role
-- já usado no resto do arquivo, só que aplicado ao SELECT que tinha ficado
-- de fora.
-- =============================================================================

DROP POLICY IF EXISTS "Company users can view company time_entries" ON public.time_entries;

CREATE POLICY "Staff da empresa e equipe interna veem apontamentos de horas"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  is_equipe_interna(auth.uid())
  OR (
    get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'technician'::app_role)
      OR has_role(auth.uid(), 'developer'::app_role)
    )
  )
);
