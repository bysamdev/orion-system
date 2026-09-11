-- =================================================================================
-- Migration: 20260911210000_rls_companies.sql
--
-- Terceiro lote dos achados P2 de RLS. Mesma forma de departments
-- (20260911200000): políticas divididas por papel, sem redundância, e
-- auth.uid() já em subselect. A consolidação é estrutural — fundir as N por
-- operação numa só com as condições em OR — mais o TO authenticated explícito.
--
-- Paridade medida antes de aplicar, mesmo método dos lotes anteriores:
--
--   usuário          papéis           empresa        SELECT   UPDATE  INSERT
--   Guilherme Born   admin            iBReady        4 -> 4   4 -> 4  pode
--   Samuel Terres    admin,developer  bysamdev       4 -> 4   4 -> 4  pode
--   Tecnico          technician       Orion System   4 -> 4   0 -> 0  NEGADO
--   samuel (SAMUEL)  customer         Orion System   1 -> 1   0 -> 0  NEGADO
--   usuario          customer         Orion System   1 -> 1   0 -> 0  NEGADO
--
-- O caso que a matriz protege aqui: cliente enxerga a própria empresa (1 de 4)
-- e nada além. Técnico enxerga as 4 por ser equipe, mas não escreve.
--
-- DELETE não foi sondado diretamente (um probe de delete em companies
-- cascatearia); sua expressão é idêntica à de UPDATE nesta tabela, antes e
-- depois, então a medição de UPDATE cobre as duas.
-- =================================================================================

DROP POLICY IF EXISTS "Developers can view all companies"           ON public.companies;
DROP POLICY IF EXISTS "Master company users can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own company"            ON public.companies;
DROP POLICY IF EXISTS "Developers can insert companies"             ON public.companies;
DROP POLICY IF EXISTS "Only master admins can insert companies"     ON public.companies;
DROP POLICY IF EXISTS "Developers can update companies"             ON public.companies;
DROP POLICY IF EXISTS "Only master admins can update companies"     ON public.companies;
DROP POLICY IF EXISTS "Developers can delete companies"             ON public.companies;
DROP POLICY IF EXISTS "Only master admins can delete companies"     ON public.companies;

-- Leitura: developer e equipe MSP veem todas; qualquer usuário vê a própria.
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR id = get_user_company_id((select auth.uid()))
  );

-- Escrita: só developer, ou admin que também seja equipe MSP.
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND is_master_company_user((select auth.uid())))
  );

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND is_master_company_user((select auth.uid())))
  );

CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND is_master_company_user((select auth.uid())))
  );
