-- =================================================================================
-- Migration: 20260911190000_piloto_rls_network_links.sql
--
-- Lote piloto dos achados P2 de RLS da auditoria de banco de 2026-09-11.
-- network_links foi escolhida por ser a maior ofensora de auth_rls_initplan
-- (8 das 37 ocorrências) e também ter sobreposição de políticas (4 de 243),
-- exercitando as duas correções numa tabela só.
--
-- Esta migration estabelece o padrão para os lotes seguintes. O método importa
-- tanto quanto o resultado, então está documentado abaixo.
--
-- ---------------------------------------------------------------------------
-- 1. Consolidação: 8 políticas -> 4
--
-- Havia duas famílias duplicadas por operação. Como políticas PERMISSIVE são
-- combinadas com OR, a regra efetiva era "A OR B":
--
--   A ("Company-scoped ..."):
--     SELECT  dev OR master OR company_id = minha
--     I/U/D   dev OR master OR ((admin OR tech) AND company_id = minha)
--
--   B ("Staff can ..." / "Users can view ..."):
--     SELECT  company_id = minha OR master
--     I/U/D   (company_id = minha OR master) AND (admin OR tech OR dev)
--
-- B é subconjunto de A, em todos os casos:
--   - usuário dev                       -> A já é verdadeiro por "dev"
--   - admin/tech na própria empresa     -> A verdadeiro por "(admin OR tech) AND minha"
--   - admin/tech via master             -> A verdadeiro por "master"
--   - master sem papel de equipe        -> A verdadeiro, B falso (A cobre mais)
--
-- Então remover a família B preserva a semântica exatamente. Isso foi provado
-- empiricamente, não só no papel — ver item 3.
--
-- ---------------------------------------------------------------------------
-- 2. Initplan: auth.uid() -> (select auth.uid())
--
-- Chamada direta força reavaliação por linha. Envolvida num subselect, o
-- planner a resolve uma vez como InitPlan. Não muda a lógica.
--
-- ---------------------------------------------------------------------------
-- 3. Como a equivalência foi verificada
--
-- Em transação revertida: inseridas duas linhas de teste, uma para cada
-- empresa com dados (iBReady e Orion System), e medida a matriz completa
-- 5 usuários x 4 operações x 2 empresas ANTES e DEPOIS da troca, no mesmo
-- BEGIN. Todas as 5 linhas deram idêntico:
--
--   usuário          papéis           SELECT  UPDATE  INSERT-iB   INSERT-Orion
--   Guilherme Born   admin            2 -> 2  2 -> 2  pode        pode
--   Samuel Terres    admin,developer  2 -> 2  2 -> 2  pode        pode
--   Tecnico          technician       2 -> 2  2 -> 2  pode        pode
--   samuel (SAMUEL)  customer         1 -> 1  0 -> 0  NEGADO      NEGADO
--   usuario          customer         1 -> 1  0 -> 0  NEGADO      NEGADO
--
-- Repetir esse mesmo procedimento nos próximos lotes. Sem a matriz medida
-- antes e depois, consolidar política é chute.
-- =================================================================================

DROP POLICY IF EXISTS "Staff can delete own company network_links" ON public.network_links;
DROP POLICY IF EXISTS "Staff can manage own company network_links" ON public.network_links;
DROP POLICY IF EXISTS "Users can view own company network_links"   ON public.network_links;
DROP POLICY IF EXISTS "Staff can update own company network_links" ON public.network_links;

DROP POLICY IF EXISTS "Company-scoped select network_links" ON public.network_links;
DROP POLICY IF EXISTS "Company-scoped insert network_links" ON public.network_links;
DROP POLICY IF EXISTS "Company-scoped update network_links" ON public.network_links;
DROP POLICY IF EXISTS "Company-scoped delete network_links" ON public.network_links;

CREATE POLICY "Company-scoped select network_links" ON public.network_links
  FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR company_id = get_user_company_id((select auth.uid()))
  );

CREATE POLICY "Company-scoped insert network_links" ON public.network_links
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR ((has_role((select auth.uid()), 'admin'::app_role)
         OR has_role((select auth.uid()), 'technician'::app_role))
        AND company_id = get_user_company_id((select auth.uid())))
  );

CREATE POLICY "Company-scoped update network_links" ON public.network_links
  FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR ((has_role((select auth.uid()), 'admin'::app_role)
         OR has_role((select auth.uid()), 'technician'::app_role))
        AND company_id = get_user_company_id((select auth.uid())))
  );

CREATE POLICY "Company-scoped delete network_links" ON public.network_links
  FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR ((has_role((select auth.uid()), 'admin'::app_role)
         OR has_role((select auth.uid()), 'technician'::app_role))
        AND company_id = get_user_company_id((select auth.uid())))
  );
