-- ORN-SEC-03: técnico da empresa mãe não pode mais conceder papéis.
--
-- O ramo is_master_company_user() das policies de INSERT e UPDATE em
-- user_roles liberava qualquer usuário da empresa mãe, inclusive technician,
-- sem limitar o papel concedido nem o alvo. Um técnico conseguia se promover
-- a developer (acesso total) pela API do Supabase.
--
-- Agora:
--   developer                 -> continua podendo tudo;
--   admin da empresa mãe      -> concede customer, technician ou admin a
--                                qualquer usuário, menos a si mesmo, e nunca
--                                developer;
--   admin de empresa cliente  -> igual antes: só na própria empresa, menos a
--                                si mesmo, e nunca admin nem developer;
--   technician e customer     -> não concedem papel nenhum.

DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
CREATE POLICY user_roles_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'developer'::app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND public.is_master_company_user((SELECT auth.uid()))
      AND user_id <> (SELECT auth.uid())
      AND role <> 'developer'::app_role
    )
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND user_id IN (SELECT profiles.id FROM public.profiles
                      WHERE profiles.company_id = public.get_user_company_id((SELECT auth.uid())))
      AND user_id <> (SELECT auth.uid())
      AND role <> ALL (ARRAY['admin'::app_role, 'developer'::app_role])
    )
  );

DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
CREATE POLICY user_roles_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'developer'::app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND public.is_master_company_user((SELECT auth.uid()))
      AND user_id <> (SELECT auth.uid())
      AND role <> 'developer'::app_role
    )
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND user_id IN (SELECT profiles.id FROM public.profiles
                      WHERE profiles.company_id = public.get_user_company_id((SELECT auth.uid())))
      AND user_id <> (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'developer'::app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND public.is_master_company_user((SELECT auth.uid()))
      AND user_id <> (SELECT auth.uid())
      AND role <> 'developer'::app_role
    )
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND user_id IN (SELECT profiles.id FROM public.profiles
                      WHERE profiles.company_id = public.get_user_company_id((SELECT auth.uid())))
      AND user_id <> (SELECT auth.uid())
      AND role <> ALL (ARRAY['admin'::app_role, 'developer'::app_role])
    )
  );
