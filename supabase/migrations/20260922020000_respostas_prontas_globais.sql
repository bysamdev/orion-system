-- Respostas prontas passam a ser globais: a mesma lista para toda a equipe,
-- de todas as empresas, em vez de uma lista por empresa.
--
-- company_id fica nulo (= global). A coluna continua existindo, e as policies
-- de escrita seguem com pode_gerir_automacao(company_id): com company_id nulo
-- ela só libera desenvolvedor e admin de empresa mãe, então gestor de empresa
-- cliente não edita a lista de todo mundo.
--
-- Leitura: toda a equipe (técnico, admin, desenvolvedor) de qualquer empresa.
-- Cliente continua sem ver.

ALTER TABLE public.canned_responses ALTER COLUMN company_id DROP NOT NULL;
UPDATE public.canned_responses SET company_id = NULL WHERE company_id IS NOT NULL;

DROP POLICY IF EXISTS "Staff da empresa e equipe interna veem respostas prontas" ON public.canned_responses;
DROP POLICY IF EXISTS "Equipe de qualquer empresa vê as respostas prontas" ON public.canned_responses;
CREATE POLICY "Equipe de qualquer empresa vê as respostas prontas" ON public.canned_responses
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'technician'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'developer'::app_role)
  );
