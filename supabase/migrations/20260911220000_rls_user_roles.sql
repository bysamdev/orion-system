-- =================================================================================
-- Migration: 20260911220000_rls_user_roles.sql
--
-- Quarto lote dos achados P2 de RLS. user_roles é a mais sensível das tabelas
-- tratadas até aqui: é a fonte de verdade que has_role() lê, e suas políticas
-- carregam a trava contra escalonamento de privilégio.
--
-- 13 políticas viram 4. A redução é estrutural, como em departments e
-- companies: as políticas cobriam papéis distintos e foram fundidas por
-- operação, com as condições combinadas por OR — que é como o Postgres já as
-- avaliava, por serem PERMISSIVE.
--
-- ---------------------------------------------------------------------------
-- A armadilha deste lote, e por que o UPDATE tem USING e WITH CHECK distintos
--
-- A política "Developers and admins can update company roles" tinha USING e
-- WITH CHECK DIFERENTES:
--
--   USING       developer OR master OR (admin AND alvo na mesma empresa)
--   WITH CHECK  idem, MAIS: alvo <> quem chama
--                     E role NÃO pode ser 'admin' nem 'developer'
--
-- Ou seja: um admin comum pode escolher linhas da própria empresa para
-- atualizar, mas o resultado não pode promover ninguém a admin/developer nem
-- alterar o próprio papel. É a trava anti-escalonamento.
--
-- Quando uma política de UPDATE declara só USING, o Postgres usa o USING
-- também como WITH CHECK. Uma versão consolidada só com USING REMOVERIA a
-- trava — um admin comum passaria a poder promover um colega a admin. Por
-- isso as duas cláusulas aparecem aqui, escritas separadamente e de propósito.
--
-- Isso só foi detectado porque a medição de paridade acusou erro. A inspeção
-- inicial usou "coalesce(qual, with_check)", que esconde exatamente este caso.
-- Nos próximos lotes, inspecionar as duas colunas separadamente, sempre.
--
-- ---------------------------------------------------------------------------
-- Paridade medida antes de aplicar, com um "admin comum" sintético
--
-- A base não tem nenhum admin fora de empresa master, então o ramo restrito
-- das políticas nunca é exercitado pelos usuários reais. Para testá-lo, um
-- admin e um alvo foram movidos para a empresa não-master dentro da transação
-- revertida. Os 9 cenários deram idêntico:
--
--   INSERT concede technician a outro ........ PODE   -> PODE
--   INSERT concede admin a outro ............. negado -> negado
--   INSERT concede developer a outro ......... negado -> negado
--   UPDATE promove outro a ADMIN ............. negado -> negado
--   SELECT Samuel Terres (admin,developer) ... 6 -> 6
--   SELECT Tecnico (technician) .............. 6 -> 6
--   SELECT Guilherme Born (admin) ............ 2 -> 2
--   SELECT samuel (SAMUEL) (customer) ........ 2 -> 2
--   SELECT usuario (customer) ................ 2 -> 2
-- =================================================================================

DROP POLICY IF EXISTS "Company users can view roles in their company"  ON public.user_roles;
DROP POLICY IF EXISTS "Developers can view all roles"                  ON public.user_roles;
DROP POLICY IF EXISTS "Master company users can view all roles"        ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role"                  ON public.user_roles;
DROP POLICY IF EXISTS "Developers and admins can insert company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Developers can insert any role"                 ON public.user_roles;
DROP POLICY IF EXISTS "Master company admins can insert any role"      ON public.user_roles;
DROP POLICY IF EXISTS "Developers and admins can update company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Developers can update any role"                 ON public.user_roles;
DROP POLICY IF EXISTS "Master company admins can update any role"      ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in their company"       ON public.user_roles;
DROP POLICY IF EXISTS "Developers can delete any role"                 ON public.user_roles;
DROP POLICY IF EXISTS "Master company admins can delete any role"      ON public.user_roles;

-- Leitura: developer e equipe MSP veem tudo; qualquer um vê o próprio papel e
-- os papéis de quem está na mesma empresa.
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.id = user_roles.user_id
                 AND p.company_id = get_user_company_id((select auth.uid())))
  );

-- Concessão de papel: admin comum só concede papéis não privilegiados, a
-- terceiros da própria empresa.
CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND user_id IN (SELECT id FROM public.profiles
                        WHERE company_id = get_user_company_id((select auth.uid())))
        AND user_id <> (select auth.uid())
        AND role <> ALL (ARRAY['admin'::app_role, 'developer'::app_role]))
  );

-- USING e WITH CHECK propositalmente diferentes: ver o bloco "A armadilha
-- deste lote" no cabeçalho. Remover o WITH CHECK aqui reabre escalonamento.
CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND user_id IN (SELECT id FROM public.profiles
                        WHERE company_id = get_user_company_id((select auth.uid()))))
  )
  WITH CHECK (
    has_role((select auth.uid()), 'developer'::app_role)
    OR is_master_company_user((select auth.uid()))
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND user_id IN (SELECT id FROM public.profiles
                        WHERE company_id = get_user_company_id((select auth.uid())))
        AND user_id <> (select auth.uid())
        AND role <> ALL (ARRAY['admin'::app_role, 'developer'::app_role]))
  );

CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND (is_master_company_user((select auth.uid()))
             OR EXISTS (SELECT 1 FROM public.profiles p
                        WHERE p.id = user_roles.user_id
                          AND p.company_id = get_user_company_id((select auth.uid())))))
  );
