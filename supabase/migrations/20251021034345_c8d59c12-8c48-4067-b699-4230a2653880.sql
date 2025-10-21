-- ============================================
-- OTIMIZAÇÃO DE PERFORMANCE: RLS POLICIES
-- ============================================
-- Substitui auth.uid() por (SELECT auth.uid()) em todas as políticas
-- para evitar reavaliação desnecessária em cada linha
-- Isso melhora significativamente a performance em tabelas grandes

-- ============================================
-- TICKET_UPDATES: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Authors can edit recent updates" ON public.ticket_updates;
CREATE POLICY "Authors can edit recent updates"
ON public.ticket_updates
FOR UPDATE
USING (
  (author_id = (SELECT auth.uid())) 
  AND (created_at > (now() - '00:15:00'::interval))
);

DROP POLICY IF EXISTS "Developers can delete any update" ON public.ticket_updates;
CREATE POLICY "Developers can delete any update"
ON public.ticket_updates
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can update any update" ON public.ticket_updates;
CREATE POLICY "Developers can update any update"
ON public.ticket_updates
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can view all ticket updates" ON public.ticket_updates;
CREATE POLICY "Developers can view all ticket updates"
ON public.ticket_updates
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can create ticket updates in their company" ON public.ticket_updates;
CREATE POLICY "Admins can create ticket updates in their company"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid())) 
  AND ((author_id = (SELECT auth.uid())) OR (author_id IS NULL))
);

DROP POLICY IF EXISTS "Admins can delete updates in their company" ON public.ticket_updates;
CREATE POLICY "Admins can delete updates in their company"
ON public.ticket_updates
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins can view ticket updates in their company" ON public.ticket_updates;
CREATE POLICY "Admins can view ticket updates in their company"
ON public.ticket_updates
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Technicians can create ticket updates in their company" ON public.ticket_updates;
CREATE POLICY "Technicians can create ticket updates in their company"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  has_role((SELECT auth.uid()), 'technician'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid())) 
  AND ((author_id = (SELECT auth.uid())) OR (author_id IS NULL))
);

DROP POLICY IF EXISTS "Technicians can view ticket updates in their company" ON public.ticket_updates;
CREATE POLICY "Technicians can view ticket updates in their company"
ON public.ticket_updates
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'technician'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Users can create updates for their tickets" ON public.ticket_updates;
CREATE POLICY "Users can create updates for their tickets"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM tickets
    WHERE (tickets.id = ticket_updates.ticket_id) 
    AND (tickets.user_id = (SELECT auth.uid()))
  )) 
  AND ((author_id = (SELECT auth.uid())) OR (author_id IS NULL))
);

DROP POLICY IF EXISTS "Users can view updates for their tickets" ON public.ticket_updates;
CREATE POLICY "Users can view updates for their tickets"
ON public.ticket_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets
    WHERE (tickets.id = ticket_updates.ticket_id) 
    AND (tickets.user_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Developers can create ticket updates" ON public.ticket_updates;
CREATE POLICY "Developers can create ticket updates"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  has_role((SELECT auth.uid()), 'developer'::app_role) 
  AND ((author_id = (SELECT auth.uid())) OR (author_id IS NULL))
);

-- ============================================
-- PROFILES: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
CREATE POLICY "Admins can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = get_user_company_id((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = get_user_company_id((SELECT auth.uid())))
)
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = get_user_company_id((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Admins can delete profiles in their company" ON public.profiles;
CREATE POLICY "Admins can delete profiles in their company"
ON public.profiles
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = get_user_company_id((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Developers can view all profiles" ON public.profiles;
CREATE POLICY "Developers can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can update any profile" ON public.profiles;
CREATE POLICY "Developers can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can delete any profile" ON public.profiles;
CREATE POLICY "Developers can delete any profile"
ON public.profiles
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (id = (SELECT auth.uid()))
WITH CHECK (
  (id = (SELECT auth.uid())) 
  AND (
    (company_id = (
      SELECT profiles_1.company_id
      FROM profiles profiles_1
      WHERE (profiles_1.id = (SELECT auth.uid()))
    )) 
    OR (company_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (id = (SELECT auth.uid()));

-- ============================================
-- TICKETS: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Customers can create their own tickets" ON public.tickets;
CREATE POLICY "Customers can create their own tickets"
ON public.tickets
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
CREATE POLICY "Customers can view their own tickets"
ON public.tickets
FOR SELECT
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Developers can update any ticket" ON public.tickets;
CREATE POLICY "Developers can update any ticket"
ON public.tickets
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can view all tickets" ON public.tickets;
CREATE POLICY "Developers can view all tickets"
ON public.tickets
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can delete any ticket" ON public.tickets;
CREATE POLICY "Developers can delete any ticket"
ON public.tickets
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can view tickets in their company" ON public.tickets;
CREATE POLICY "Admins can view tickets in their company"
ON public.tickets
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = tickets.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Admins can update tickets in their company" ON public.tickets;
CREATE POLICY "Admins can update tickets in their company"
ON public.tickets
FOR UPDATE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = tickets.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Admins can delete tickets in their company" ON public.tickets;
CREATE POLICY "Admins can delete tickets in their company"
ON public.tickets
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = tickets.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Technicians can view tickets in their company" ON public.tickets;
CREATE POLICY "Technicians can view tickets in their company"
ON public.tickets
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'technician'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = tickets.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Technicians can update tickets in their company" ON public.tickets;
CREATE POLICY "Technicians can update tickets in their company"
ON public.tickets
FOR UPDATE
USING (
  has_role((SELECT auth.uid()), 'technician'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = tickets.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

-- ============================================
-- COMPANIES: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Developers can view all companies" ON public.companies;
CREATE POLICY "Developers can view all companies"
ON public.companies
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can view their own company" ON public.companies;
CREATE POLICY "Admins can view their own company"
ON public.companies
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Developers can insert companies" ON public.companies;
CREATE POLICY "Developers can insert companies"
ON public.companies
FOR INSERT
WITH CHECK (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can update companies" ON public.companies;
CREATE POLICY "Developers can update companies"
ON public.companies
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can delete companies" ON public.companies;
CREATE POLICY "Developers can delete companies"
ON public.companies
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

-- ============================================
-- DEPARTMENTS: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Developers can view all departments" ON public.departments;
CREATE POLICY "Developers can view all departments"
ON public.departments
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can view departments in their company" ON public.departments;
CREATE POLICY "Admins can view departments in their company"
ON public.departments
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users can view departments from their company" ON public.departments;
CREATE POLICY "Users can view departments from their company"
ON public.departments
FOR SELECT
USING (
  company_id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Developers can create any department" ON public.departments;
CREATE POLICY "Developers can create any department"
ON public.departments
FOR INSERT
WITH CHECK (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can update any department" ON public.departments;
CREATE POLICY "Developers can update any department"
ON public.departments
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can delete any department" ON public.departments;
CREATE POLICY "Developers can delete any department"
ON public.departments
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can create departments in their company" ON public.departments;
CREATE POLICY "Admins can create departments in their company"
ON public.departments
FOR INSERT
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Admins can update departments in their company" ON public.departments;
CREATE POLICY "Admins can update departments in their company"
ON public.departments
FOR UPDATE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Admins can delete departments from their company" ON public.departments;
CREATE POLICY "Admins can delete departments from their company"
ON public.departments
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (company_id = (
    SELECT profiles.company_id
    FROM profiles
    WHERE (profiles.id = (SELECT auth.uid()))
  ))
);

-- ============================================
-- USER_ROLES: Políticas Otimizadas
-- ============================================

DROP POLICY IF EXISTS "Developers can view all roles" ON public.user_roles;
CREATE POLICY "Developers can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can view roles in their company" ON public.user_roles;
CREATE POLICY "Admins can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = user_roles.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Developers can insert any role" ON public.user_roles;
CREATE POLICY "Developers can insert any role"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can update any role" ON public.user_roles;
CREATE POLICY "Developers can update any role"
ON public.user_roles
FOR UPDATE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Developers can delete any role" ON public.user_roles;
CREATE POLICY "Developers can delete any role"
ON public.user_roles
FOR DELETE
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

DROP POLICY IF EXISTS "Admins can insert roles for users in their company" ON public.user_roles;
CREATE POLICY "Admins can insert roles for users in their company"
ON public.user_roles
FOR INSERT
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = user_roles.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Admins can update roles in their company" ON public.user_roles;
CREATE POLICY "Admins can update roles in their company"
ON public.user_roles
FOR UPDATE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = user_roles.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);

DROP POLICY IF EXISTS "Admins can delete roles in their company" ON public.user_roles;
CREATE POLICY "Admins can delete roles in their company"
ON public.user_roles
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  AND (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = user_roles.user_id) 
    AND (p.company_id = (
      SELECT profiles.company_id
      FROM profiles
      WHERE (profiles.id = (SELECT auth.uid()))
    ))
  ))
);