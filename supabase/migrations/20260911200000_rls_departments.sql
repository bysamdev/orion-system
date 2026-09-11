-- =================================================================================
-- Migration: 20260911200000_rls_departments.sql
--
-- Segundo lote dos achados P2 de RLS (o primeiro foi
-- 20260911190000_piloto_rls_network_links.sql, que estabeleceu o método).
--
-- departments tem forma DIFERENTE do piloto, e a diferença importa:
--
--   - Em network_links havia redundância real: duas famílias de políticas,
--     uma subconjunto da outra. Remover uma preservava a semântica.
--
--   - Aqui NÃO há redundância. As 9 políticas cobrem papéis distintos
--     (admin+própria empresa, developer, technician+própria empresa) e cada
--     uma contribui com casos que as outras não cobrem. A consolidação é
--     puramente estrutural: fundir as N políticas por operação numa só, com
--     as condições combinadas por OR — que é exatamente como o Postgres já
--     as avaliava, por serem PERMISSIVE.
--
-- auth.uid() já estava envolvido em subselect nesta tabela (departments não
-- aparece na lista de auth_rls_initplan do advisor), então aqui não há ganho
-- de initplan — só a redução de 9 políticas para 4.
--
-- O ganho adicional é o TO authenticated explícito. As políticas eram
-- {public}, o que fazia anon avaliá-las a cada requisição para só então
-- receber falso. Além do custo, isso é o que hoje impede revogar o EXECUTE
-- das funções auxiliares de RLS (has_role e companhia) do papel anon: com as
-- políticas declaradas TO authenticated, anon deixa de avaliá-las e a
-- revogação passa a ser segura. Ver a nota no fim de
-- 20260911170000_revoga_execute_indevido_e_indice_duplicado.sql.
--
-- ---------------------------------------------------------------------------
-- Paridade medida antes de aplicar, mesmo método do piloto: matriz completa
-- capturada ANTES e DEPOIS no mesmo BEGIN revertido. As 5 linhas idênticas:
--
--   usuário          papéis           empresa        SELECT    UPDATE   INS-própria  INS-outra
--   Guilherme Born   admin            iBReady         0 ->  0   0 -> 0  pode         NEGADO
--   Samuel Terres    admin,developer  bysamdev       18 -> 18  18 ->18  pode         pode
--   Tecnico          technician       Orion System    6 ->  6   0 -> 0  NEGADO       NEGADO
--   samuel (SAMUEL)  customer         Orion System    0 ->  0   0 -> 0  NEGADO       NEGADO
--   usuario          customer         Orion System    0 ->  0   0 -> 0  NEGADO       NEGADO
--
-- Dois casos que a matriz protegeu e que seria fácil quebrar de olho:
-- technician lê departamentos mas não escreve, e admin de empresa sem
-- departamento nenhum (iBReady) continua podendo criar na própria empresa.
-- =================================================================================

DROP POLICY IF EXISTS "Admins can view departments in their company"     ON public.departments;
DROP POLICY IF EXISTS "Developers can view all departments"              ON public.departments;
DROP POLICY IF EXISTS "Technicians can view company departments"         ON public.departments;
DROP POLICY IF EXISTS "Admins can create departments in their company"   ON public.departments;
DROP POLICY IF EXISTS "Developers can create any department"             ON public.departments;
DROP POLICY IF EXISTS "Admins can update departments in their company"   ON public.departments;
DROP POLICY IF EXISTS "Developers can update any department"             ON public.departments;
DROP POLICY IF EXISTS "Admins can delete departments from their company" ON public.departments;
DROP POLICY IF EXISTS "Developers can delete any department"             ON public.departments;

-- Leitura: developer em qualquer empresa; admin e technician na própria.
CREATE POLICY "departments_select" ON public.departments
  FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR ((has_role((select auth.uid()), 'admin'::app_role)
         OR has_role((select auth.uid()), 'technician'::app_role))
        AND company_id = get_user_company_id((select auth.uid())))
  );

-- Escrita: technician NÃO escreve (era assim antes, e continua).
CREATE POLICY "departments_insert" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND company_id = get_user_company_id((select auth.uid())))
  );

CREATE POLICY "departments_update" ON public.departments
  FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND company_id = get_user_company_id((select auth.uid())))
  );

CREATE POLICY "departments_delete" ON public.departments
  FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND company_id = get_user_company_id((select auth.uid())))
  );
