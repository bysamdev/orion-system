-- Fix critical security issue: Prevent users from changing their company_id
-- This prevents users from accessing other companies' ticket data

-- Drop the existing overly permissive update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create a new policy that prevents company_id changes
CREATE POLICY "Users can update their own profile except company"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) OR company_id IS NULL)
);

-- Create admin-only policy for company assignment
CREATE POLICY "Admins can update any profile including company"
ON profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));