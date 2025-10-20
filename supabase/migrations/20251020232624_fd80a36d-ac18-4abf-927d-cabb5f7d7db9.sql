-- ============================================================
-- CRITICAL FIX: Hierarquia de Permissões
-- Developer: Acesso TOTAL a todas as empresas
-- Admin: Acesso APENAS à SUA empresa
-- ============================================================

-- ============================================================
-- TABLE: companies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Developers can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Developers can update companies" ON public.companies;
DROP POLICY IF EXISTS "Developers can delete companies" ON public.companies;

-- New policies
CREATE POLICY "Developers can view all companies"
ON public.companies FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view their own company"
ON public.companies FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view their own company"
ON public.companies FOR SELECT
USING (
  id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can insert companies"
ON public.companies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can update companies"
ON public.companies FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can delete companies"
ON public.companies FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- ============================================================
-- TABLE: departments
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view departments from their company" ON public.departments;
DROP POLICY IF EXISTS "Admins can create departments for their company" ON public.departments;
DROP POLICY IF EXISTS "Admins can update departments in their company" ON public.departments;
DROP POLICY IF EXISTS "Admins can delete departments from their company" ON public.departments;

-- New policies
CREATE POLICY "Developers can view all departments"
ON public.departments FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view departments in their company"
ON public.departments FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view departments from their company"
ON public.departments FOR SELECT
USING (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can create any department"
ON public.departments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can create departments in their company"
ON public.departments FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can update any department"
ON public.departments FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can update departments in their company"
ON public.departments FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can delete any department"
ON public.departments FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can delete departments from their company"
ON public.departments FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================
-- TABLE: profiles
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Developers can delete any profile" ON public.profiles;

-- New policies
CREATE POLICY "Developers can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "Developers can update any profile"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) OR company_id IS NULL)
);

CREATE POLICY "Developers can delete any profile"
ON public.profiles FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can delete profiles in their company"
ON public.profiles FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================
-- TABLE: tickets
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customers can create their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Technicians and admins can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;

-- New policies with company scoping
CREATE POLICY "Developers can view all tickets"
ON public.tickets FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view tickets in their company"
ON public.tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Technicians can view tickets in their company"
ON public.tickets FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Customers can view their own tickets"
ON public.tickets FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Customers can create their own tickets"
ON public.tickets FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Developers can update any ticket"
ON public.tickets FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can update tickets in their company"
ON public.tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Technicians can update tickets in their company"
ON public.tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Developers can delete any ticket"
ON public.tickets FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can delete tickets in their company"
ON public.tickets FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- ============================================================
-- TABLE: ticket_updates
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view updates for their tickets" ON public.ticket_updates;
DROP POLICY IF EXISTS "Authenticated users can create updates for accessible tickets" ON public.ticket_updates;

-- New policies with company scoping
CREATE POLICY "Developers can view all ticket updates"
ON public.ticket_updates FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view ticket updates in their company"
ON public.ticket_updates FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM tickets t
    INNER JOIN profiles p ON p.id = t.user_id
    WHERE t.id = ticket_updates.ticket_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Technicians can view ticket updates in their company"
ON public.ticket_updates FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM tickets t
    INNER JOIN profiles p ON p.id = t.user_id
    WHERE t.id = ticket_updates.ticket_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view updates for their tickets"
ON public.ticket_updates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_updates.ticket_id
    AND tickets.user_id = auth.uid()
  )
);

CREATE POLICY "Developers can create ticket updates"
ON public.ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role)
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Admins can create ticket updates in their company"
ON public.ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM tickets t
    INNER JOIN profiles p ON p.id = t.user_id
    WHERE t.id = ticket_updates.ticket_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Technicians can create ticket updates in their company"
ON public.ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM tickets t
    INNER JOIN profiles p ON p.id = t.user_id
    WHERE t.id = ticket_updates.ticket_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Users can create updates for their tickets"
ON public.ticket_updates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_updates.ticket_id
    AND tickets.user_id = auth.uid()
  )
  AND (author_id = auth.uid() OR author_id IS NULL)
);

-- ============================================================
-- TABLE: user_roles
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own roles or admins/developers can view al" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and developers can manage roles" ON public.user_roles;

-- New policies with company scoping
CREATE POLICY "Developers can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can view roles in their company"
ON public.user_roles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Developers can insert any role"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can insert roles for users in their company"
ON public.user_roles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Developers can update any role"
ON public.user_roles FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can update roles in their company"
ON public.user_roles FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Developers can delete any role"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Admins can delete roles in their company"
ON public.user_roles FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);