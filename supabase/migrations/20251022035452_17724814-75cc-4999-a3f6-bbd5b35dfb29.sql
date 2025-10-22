-- Drop existing policies that will be replaced
DROP POLICY IF EXISTS "Company admins can view company tickets" ON tickets;
DROP POLICY IF EXISTS "Company admins can update company tickets" ON tickets;
DROP POLICY IF EXISTS "Company admins can delete company tickets" ON tickets;
DROP POLICY IF EXISTS "Company technicians can view company tickets" ON tickets;
DROP POLICY IF EXISTS "Company technicians can update company tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can update all tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can delete all tickets" ON tickets;

DROP POLICY IF EXISTS "Company admins can view company ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Company admins can create company ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Company admins can delete company ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Company technicians can view company ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Company technicians can create company ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Master admins can view all ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Master admins can create all ticket updates" ON ticket_updates;
DROP POLICY IF EXISTS "Master admins can delete all ticket updates" ON ticket_updates;

DROP POLICY IF EXISTS "Developers can view all companies" ON companies;
DROP POLICY IF EXISTS "Developers can insert companies" ON companies;
DROP POLICY IF EXISTS "Developers can update companies" ON companies;
DROP POLICY IF EXISTS "Developers can delete companies" ON companies;
DROP POLICY IF EXISTS "Master company users can view all companies" ON companies;
DROP POLICY IF EXISTS "Only master admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Only master admins can update companies" ON companies;
DROP POLICY IF EXISTS "Only master admins can delete companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;

-- ============================================
-- TICKETS - New Multi-Tenant Policies
-- ============================================

-- Master admins (Orion System) can see ALL tickets
CREATE POLICY "Master admins can view all tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master admins can update all tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master admins can delete all tickets"
ON tickets FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

-- Company admins can only see tickets from their company
CREATE POLICY "Company admins can view company tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Company admins can update company tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Company admins can delete company tickets"
ON tickets FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Company technicians can only see tickets from their company
CREATE POLICY "Company technicians can view company tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Company technicians can update company tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = tickets.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- ============================================
-- TICKET_UPDATES - New Multi-Tenant Policies
-- ============================================

-- Master admins (Orion System) can see ALL ticket updates
CREATE POLICY "Master admins can view all ticket updates"
ON ticket_updates FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master admins can create all ticket updates"
ON ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Master admins can delete all ticket updates"
ON ticket_updates FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

-- Company admins can only see updates from tickets of their company
CREATE POLICY "Company admins can view company ticket updates"
ON ticket_updates FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Company admins can create company ticket updates"
ON ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Company admins can delete company ticket updates"
ON ticket_updates FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Company technicians can only see updates from tickets of their company
CREATE POLICY "Company technicians can view company ticket updates"
ON ticket_updates FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Company technicians can create company ticket updates"
ON ticket_updates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role)
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
  AND (author_id = auth.uid() OR author_id IS NULL)
);

-- ============================================
-- COMPANIES - Restrict to Master Admins Only
-- ============================================

-- Only Developers can manage everything (fallback for system maintenance)
CREATE POLICY "Developers can view all companies"
ON companies FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can insert companies"
ON companies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can update companies"
ON companies FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can delete companies"
ON companies FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- Only Orion System admins can manage companies
CREATE POLICY "Only master admins can insert companies"
ON companies FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Only master admins can update companies"
ON companies FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Only master admins can delete companies"
ON companies FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

-- Master company users (Orion System) can view all companies
CREATE POLICY "Master company users can view all companies"
ON companies FOR SELECT
USING (is_master_company_user(auth.uid()));

-- Regular users can view their own company
CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
USING (id = get_user_company_id(auth.uid()));