-- =================================================================================
-- Migration: 20260825000000_fix_user_roles_privilege_escalation.sql
-- Descrição: Fecha escalação de privilégio em public.user_roles.
--
-- Bugs corrigidos:
-- 1. Policy "Prevent self-promotion to admin" (INSERT) tinha OR incorreto:
--    (user_id != auth.uid() OR role != 'admin') é verdadeiro quando
--    role = 'developer' mesmo com user_id = auth.uid() -- qualquer usuário
--    autenticado podia se auto-conceder o papel global 'developer'.
-- 2. Policy "Admins can update roles in their company" (UPDATE) não tinha
--    WITH CHECK -- um admin de tenant podia trocar o próprio role pra
--    'developer' via UPDATE, já que só a condição pré-update era validada.
--
-- Correção: substitui as três policies de INSERT/UPDATE por uma única regra
-- por operação, onde: developer e master company user têm controle total;
-- admin de tenant só pode conceder/alterar papéis não-privilegiados
-- (nunca 'admin' ou 'developer') e nunca para si mesmo.
-- =================================================================================

DROP POLICY IF EXISTS "Admins can insert roles for users in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Prevent self-promotion to admin" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles in their company" ON public.user_roles;

CREATE POLICY "Developers and admins can insert company roles"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role)
  OR is_master_company_user(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id IN (SELECT id FROM public.profiles WHERE company_id = get_user_company_id(auth.uid()))
    AND user_id != auth.uid()
    AND role NOT IN ('admin'::app_role, 'developer'::app_role)
  )
);

CREATE POLICY "Developers and admins can update company roles"
ON public.user_roles
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'developer'::app_role)
  OR is_master_company_user(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id IN (SELECT id FROM public.profiles WHERE company_id = get_user_company_id(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role)
  OR is_master_company_user(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id IN (SELECT id FROM public.profiles WHERE company_id = get_user_company_id(auth.uid()))
    AND user_id != auth.uid()
    AND role NOT IN ('admin'::app_role, 'developer'::app_role)
  )
);
