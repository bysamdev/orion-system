-- =============================================================================
-- Migration: 20260904100100_fix_ch_c07_scope_ticket_ratings_select_by_company.sql
--
-- Fix CH-C07: scope ticket_ratings SELECT by company
--
-- Descrição:
--   A policy de SELECT de public.ticket_ratings não tinha nenhum predicado de
--   empresa e nenhum join de volta em tickets. Definição encontrada em
--   produção:
--
--     "Technicians and admins can see ratings" SELECT TO authenticated
--     USING (EXISTS (SELECT 1 FROM user_roles
--                    WHERE user_roles.user_id = auth.uid()
--                      AND user_roles.role = ANY (ARRAY['technician','admin','developer'])))
--
--   Bastava ter papel technician/admin/developer em QUALQUER empresa para ler
--   toda linha de avaliação de TODO tenant — incluindo ticket_ratings.comment,
--   texto livre escrito pelo cliente, e ticket_ratings.user_id.
--
--   Todas as demais tabelas do domínio escopam com ticket_belongs_to_user_company()
--   ou get_ticket_company_id(); ticket_ratings ficou de fora. Esta migration
--   alinha a tabela ao mesmo padrão, usando is_equipe_interna() como ponto único
--   de decisão de escopo cross-company, igual a 20260901220000.
--
-- Comportamento após a mudança:
--   - equipe interna (developer, technician, ou admin de empresa master) segue
--     vendo todas as avaliações — mantém o modelo MSP já vigente no projeto;
--   - admin/technician de empresa comum passa a ver apenas avaliações de
--     chamados da própria empresa;
--   - customer continua sem SELECT (comportamento atual preservado, ver nota).
--
-- NOTA, fora do escopo desta migration:
--   Não existe policy de SELECT para o dono do chamado, então o cliente não
--   consegue reler a própria avaliação. src/hooks/useTicketRating.ts é usado
--   por src/pages/Avaliacao.tsx justamente para detectar avaliação já enviada,
--   e hoje sempre volta vazio para o cliente. Isso é um defeito funcional
--   separado (registrado no relatório); NÃO foi corrigido aqui para manter a
--   migration restrita ao achado de segurança CH-C07.
-- =============================================================================

DROP POLICY IF EXISTS "Technicians and admins can see ratings" ON public.ticket_ratings;

CREATE POLICY "Equipe interna e staff da empresa veem avaliacoes"
ON public.ticket_ratings
FOR SELECT
TO authenticated
USING (
  is_equipe_interna((SELECT auth.uid()))
  OR (
    ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
    AND (
      has_role((SELECT auth.uid()), 'admin'::app_role)
      OR has_role((SELECT auth.uid()), 'technician'::app_role)
    )
  )
);

-- Verificação pós-aplicação:
--
--   SELECT policyname, cmd, roles::text, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'ticket_ratings';
--
-- Esperado: a policy antiga "Technicians and admins can see ratings" não
-- aparece mais, e a nova traz o predicado de empresa.
