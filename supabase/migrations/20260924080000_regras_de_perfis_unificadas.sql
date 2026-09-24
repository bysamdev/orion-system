-- Advisor do Supabase (multiple_permissive_policies), última tabela:
-- profiles tinha 4 policies de SELECT, 4 de UPDATE e 3 de DELETE. Cada
-- operação vira uma policy só, com o OR das antigas; o acesso não muda.
--
-- UPDATE: o WITH CHECK é o OR dos WITH CHECK antigos. A policy de developer
-- não tinha WITH CHECK, então valia o USING dela (developer); a do próprio
-- usuário continua impedindo que ele troque a própria empresa.

DROP POLICY IF EXISTS "Company users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Master company users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Master company admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can delete any profile" ON public.profiles;
DROP POLICY IF EXISTS "Master company admins can delete all profiles" ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (SELECT public.is_master_company_user((SELECT auth.uid())))
    OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
        AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
             OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
  )
  WITH CHECK (
    (id = (SELECT auth.uid())
     AND (company_id = (SELECT public.get_user_company_id((SELECT auth.uid()))) OR company_id IS NULL))
    OR (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
        AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
             OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
  );

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
        AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
             OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
  );
