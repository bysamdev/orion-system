-- Fix para o RLS do Canned Responses que impedia Técnicos de visualizar os templates

DROP POLICY IF EXISTS "Admins can view company canned responses" ON public.canned_responses;
DROP POLICY IF EXISTS "Technicians and admins can view company canned responses" ON public.canned_responses;

CREATE POLICY "Technicians and admins can view company canned responses"
ON public.canned_responses
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);
