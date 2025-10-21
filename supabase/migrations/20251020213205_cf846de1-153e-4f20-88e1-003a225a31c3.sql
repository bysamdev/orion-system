-- ========================================
-- FIX 1: Remove duplicate indexes
-- ========================================

-- Drop the older duplicate indexes (keep the DESC ones as they're more useful)
DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_tickets_status_created;

-- ========================================
-- FIX 2: Optimize RLS policies - Replace auth.uid() with (select auth.uid())
-- ========================================

-- TICKETS TABLE
DROP POLICY IF EXISTS "Customers can view their own tickets" ON tickets;
CREATE POLICY "Customers can view their own tickets" ON tickets
  FOR SELECT USING (
    user_id = (select auth.uid()) OR 
    has_role((select auth.uid()), 'technician') OR 
    has_role((select auth.uid()), 'admin')
  );

DROP POLICY IF EXISTS "Customers can create their own tickets" ON tickets;
CREATE POLICY "Customers can create their own tickets" ON tickets
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Technicians and admins can update tickets" ON tickets;
CREATE POLICY "Technicians and admins can update tickets" ON tickets
  FOR UPDATE USING (
    has_role((select auth.uid()), 'technician') OR 
    has_role((select auth.uid()), 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete tickets" ON tickets;
CREATE POLICY "Admins can delete tickets" ON tickets
  FOR DELETE USING (has_role((select auth.uid()), 'admin'));

-- TICKET_UPDATES TABLE
DROP POLICY IF EXISTS "Users can view updates for their tickets" ON ticket_updates;
CREATE POLICY "Users can view updates for their tickets" ON ticket_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_updates.ticket_id
        AND (
          tickets.user_id = (select auth.uid()) OR 
          has_role((select auth.uid()), 'technician') OR 
          has_role((select auth.uid()), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create updates for accessible tickets" ON ticket_updates;
CREATE POLICY "Authenticated users can create updates for accessible tickets" ON ticket_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_updates.ticket_id
        AND (
          tickets.user_id = (select auth.uid()) OR 
          has_role((select auth.uid()), 'technician') OR 
          has_role((select auth.uid()), 'admin')
        )
    )
    AND (author_id = (select auth.uid()) OR author_id IS NULL)
  );

-- USER_ROLES TABLE - Combine multiple permissive policies into one
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;

CREATE POLICY "Users can view their own roles or admins can view all" ON user_roles
  FOR SELECT USING (
    user_id = (select auth.uid()) OR 
    has_role((select auth.uid()), 'admin')
  );

CREATE POLICY "Only admins can manage roles" ON user_roles
  FOR ALL USING (has_role((select auth.uid()), 'admin'))
  WITH CHECK (has_role((select auth.uid()), 'admin'));

-- PROFILES TABLE - Combine multiple UPDATE policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON profiles;
CREATE POLICY "Users can view their own profile or admins can view all" ON profiles
  FOR SELECT USING (
    id = (select auth.uid()) OR 
    has_role((select auth.uid()), 'admin')
  );

DROP POLICY IF EXISTS "Users can update their own profile except company" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile including company" ON profiles;

CREATE POLICY "Users can update profiles" ON profiles
  FOR UPDATE USING (
    id = (select auth.uid()) OR 
    has_role((select auth.uid()), 'admin')
  )
  WITH CHECK (
    (id = (select auth.uid()) AND (
      company_id = (SELECT company_id FROM profiles WHERE id = (select auth.uid())) OR 
      company_id IS NULL
    )) OR 
    has_role((select auth.uid()), 'admin')
  );

-- COMPANIES TABLE - Combine multiple SELECT policies
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;

CREATE POLICY "Users can view companies" ON companies
  FOR SELECT USING (
    has_role((select auth.uid()), 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.company_id = companies.id
    )
  );

DROP POLICY IF EXISTS "Admins can insert companies" ON companies;
CREATE POLICY "Admins can insert companies" ON companies
  FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can update companies" ON companies;
CREATE POLICY "Admins can update companies" ON companies
  FOR UPDATE USING (has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can delete companies" ON companies;
CREATE POLICY "Admins can delete companies" ON companies
  FOR DELETE USING (has_role((select auth.uid()), 'admin'));