-- Migration: scope_api_keys_rls_by_company
-- SEC-05: a policy de public.api_keys criada em
-- 20260812160000_fix_api_keys_rls_policy.sql concedia acesso total (FOR ALL)
-- a qualquer usuário com role 'admin', sem restringir por empresa. Como
-- role 'admin' é um papel de tenant (cada empresa cliente tem seus próprios
-- admins), isso permitia que um admin da Empresa A visualizasse e gerenciasse
-- as chaves de API de qualquer outra empresa. Agora o acesso de admin fica
-- restrito a company_id = get_user_company_id(auth.uid()); developer e
-- membros da empresa master continuam com visão global.

DROP POLICY IF EXISTS "Only developers and admins can manage API keys" ON public.api_keys;

CREATE POLICY "Only developers and admins can manage API keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (
  is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND company_id = get_user_company_id(auth.uid())
  )
)
WITH CHECK (
  is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND company_id = get_user_company_id(auth.uid())
  )
);
