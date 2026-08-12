-- Fix RLS Policy for api_keys to avoid scalar subquery exception when user has multiple roles
DROP POLICY IF EXISTS "Only developers and admins can manage API keys" ON public.api_keys;

CREATE POLICY "Only developers and admins can manage API keys" 
ON public.api_keys
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'developer'::app_role) 
  OR is_master_company_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'developer'::app_role) 
  OR is_master_company_user(auth.uid())
);
