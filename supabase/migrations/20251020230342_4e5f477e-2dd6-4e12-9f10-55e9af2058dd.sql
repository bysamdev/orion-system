-- Update RLS policies for companies table to restrict admin access
DROP POLICY IF EXISTS "Users can view companies" ON companies;
DROP POLICY IF EXISTS "Admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
DROP POLICY IF EXISTS "Admins can delete companies" ON companies;

-- Companies: Only developers can manage, admins and users can view their own
CREATE POLICY "Users can view companies"
ON companies FOR SELECT
USING (
  has_role((select auth.uid()), 'developer'::app_role)
  OR has_role((select auth.uid()), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.company_id = companies.id
  )
);

CREATE POLICY "Developers can insert companies"
ON companies FOR INSERT
WITH CHECK (has_role((select auth.uid()), 'developer'::app_role));

CREATE POLICY "Developers can update companies"
ON companies FOR UPDATE
USING (has_role((select auth.uid()), 'developer'::app_role));

CREATE POLICY "Developers can delete companies"
ON companies FOR DELETE
USING (has_role((select auth.uid()), 'developer'::app_role));

-- Update user_roles policies to allow developers full access
DROP POLICY IF EXISTS "Users can view their own roles or admins can view all" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;

CREATE POLICY "Users can view their own roles or admins/developers can view all"
ON user_roles FOR SELECT
USING (
  user_id = (select auth.uid())
  OR has_role((select auth.uid()), 'admin'::app_role)
  OR has_role((select auth.uid()), 'developer'::app_role)
);

CREATE POLICY "Admins and developers can manage roles"
ON user_roles FOR ALL
USING (
  has_role((select auth.uid()), 'admin'::app_role)
  OR has_role((select auth.uid()), 'developer'::app_role)
)
WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role)
  OR has_role((select auth.uid()), 'developer'::app_role)
);