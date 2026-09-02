-- =============================================================================
-- Migration: 20260901231500_fix_contracts_canned_responses_customer_visibility.sql
--
-- Descrição: mesma classe de problema corrigida em time_entries
-- (20260901230000) -- as policies unificadas de 20260901220000 usaram
-- `company_id = get_user_company_id(auth.uid()) OR is_equipe_interna(...)`
-- pra contracts e canned_responses, o que deixa QUALQUER usuário da
-- empresa, inclusive customer, ler essas tabelas.
--
-- contracts: usado só em src/components/admin/ContractManagement.tsx
-- (painel admin) -- nenhum uso customer-facing encontrado no frontend.
--
-- canned_responses: macro/atalho de resposta pra staff. O único componente
-- que renderiza a lista pro usuário (CannedResponseSelector) já é
-- condicionado a `canManageTickets` em TicketDetails.tsx:849 -- não há
-- necessidade de customer ler essa tabela.
--
-- sla_configs FICOU DE FORA de propósito: src/pages/NewTicket.tsx (tela
-- de abertura de chamado, acessível a customer) mostra as horas de SLA
-- por prioridade direto pro cliente durante a criação do ticket
-- (activeSla.urgent_hours etc, linhas 725-743) -- sem esse acesso o
-- cliente veria um fallback genérico (4h/12h/24h/48h) em vez do SLA real
-- contratado da empresa. Fechar aqui quebraria essa tela.
-- =============================================================================

DROP POLICY IF EXISTS "Usuarios podem ver contratos da empresa" ON public.contracts;

CREATE POLICY "Staff da empresa e equipe interna veem contratos"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  is_equipe_interna(auth.uid())
  OR (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'technician'::app_role)
      OR has_role(auth.uid(), 'developer'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Usuarios podem ver respostas prontas da empresa" ON public.canned_responses;

CREATE POLICY "Staff da empresa e equipe interna veem respostas prontas"
ON public.canned_responses
FOR SELECT
TO authenticated
USING (
  is_equipe_interna(auth.uid())
  OR (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'technician'::app_role)
      OR has_role(auth.uid(), 'developer'::app_role)
    )
  )
);
