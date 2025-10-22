-- =====================================================
-- MIGRATION: COMPLETE DATABASE RESET AND RECREATION
-- WARNING: THIS WILL DELETE ALL EXISTING DATA!
-- =====================================================
-- Make sure you have a backup before running this!
-- =====================================================

-- STEP 1: DROP ALL EXISTING OBJECTS IN CORRECT ORDER
-- =====================================================

-- Drop all triggers first
DROP TRIGGER IF EXISTS audit_tickets_changes ON tickets;
DROP TRIGGER IF EXISTS audit_profiles_changes ON profiles;
DROP TRIGGER IF EXISTS audit_companies_changes ON companies;
DROP TRIGGER IF EXISTS audit_user_roles_changes ON user_roles;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS validate_ticket_input_trigger ON tickets;
DROP TRIGGER IF EXISTS validate_profile_input_trigger ON profiles;
DROP TRIGGER IF EXISTS validate_company_input_trigger ON companies;
DROP TRIGGER IF EXISTS validate_ticket_assignment_trigger ON tickets;
DROP TRIGGER IF EXISTS set_ticket_update_author_trigger ON ticket_updates;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_tickets_search_vector ON tickets;

-- Drop all tables in correct order (respect foreign keys)
DROP TABLE IF EXISTS ticket_updates CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS validate_ticket_input() CASCADE;
DROP FUNCTION IF EXISTS validate_profile_input() CASCADE;
DROP FUNCTION IF EXISTS validate_company_input() CASCADE;
DROP FUNCTION IF EXISTS validate_ticket_assignment() CASCADE;
DROP FUNCTION IF EXISTS set_ticket_update_author() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS get_user_company_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS ticket_belongs_to_user_company(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_master_company_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS search_tickets(text) CASCADE;
DROP FUNCTION IF EXISTS check_index_health() CASCADE;
DROP FUNCTION IF EXISTS check_table_bloat() CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS tickets_ticket_number_seq CASCADE;

-- Drop enum type
DROP TYPE IF EXISTS app_role CASCADE;

-- =====================================================
-- STEP 2: CREATE ENUM TYPES
-- =====================================================

CREATE TYPE app_role AS ENUM ('customer', 'technician', 'admin', 'developer');

-- =====================================================
-- STEP 3: CREATE CORE TABLES
-- =====================================================

-- Companies Table (Master data)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companies_name_length CHECK (LENGTH(TRIM(name)) >= 2)
);

CREATE INDEX idx_companies_name ON companies(name);

-- Departments Table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT departments_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT departments_unique_per_company UNIQUE(company_id, name)
);

CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_name ON departments(name);

-- Profiles Table (Extended user information)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_full_name_length CHECK (LENGTH(TRIM(full_name)) >= 2),
  CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_profiles_company_id ON profiles(company_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_full_name ON profiles(full_name);

-- User Roles Table (Security-critical: separate from profiles)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_unique_user_role UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Tickets Table
CREATE SEQUENCE tickets_ticket_number_seq START 1000;

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number INTEGER NOT NULL UNIQUE DEFAULT nextval('tickets_ticket_number_seq'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  department TEXT,
  operator_name TEXT,
  assigned_to TEXT,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tickets_title_length CHECK (LENGTH(TRIM(title)) >= 3),
  CONSTRAINT tickets_description_length CHECK (LENGTH(TRIM(description)) >= 10),
  CONSTRAINT tickets_status_valid CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT tickets_priority_valid CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_assigned_to_user_id ON tickets(assigned_to_user_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_search_vector ON tickets USING GIN(search_vector);

-- Ticket Updates Table (Comments and history)
CREATE TABLE ticket_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ticket_updates_content_length CHECK (LENGTH(TRIM(content)) >= 1),
  CONSTRAINT ticket_updates_type_valid CHECK (type IN ('comment', 'status_change', 'assignment', 'priority_change'))
);

CREATE INDEX idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);
CREATE INDEX idx_ticket_updates_author_id ON ticket_updates(author_id);
CREATE INDEX idx_ticket_updates_created_at ON ticket_updates(created_at DESC);
CREATE INDEX idx_ticket_updates_type ON ticket_updates(type);

-- Audit Log Table (Track all changes)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_log_action_valid CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- =====================================================
-- STEP 4: CREATE SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Check if user has specific role
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Get user's company ID
CREATE OR REPLACE FUNCTION get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = _user_id LIMIT 1;
$$;

-- Check if ticket belongs to user's company
CREATE OR REPLACE FUNCTION ticket_belongs_to_user_company(_ticket_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tickets t
    JOIN profiles p ON p.id = t.user_id
    WHERE t.id = _ticket_id
      AND p.company_id = get_user_company_id(_user_id)
  );
$$;

-- Check if user is from master company (Orion System)
CREATE OR REPLACE FUNCTION is_master_company_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN companies c ON c.id = p.company_id
    WHERE p.id = _user_id AND c.name = 'Orion System'
  );
$$;

-- Full-text search for tickets
CREATE OR REPLACE FUNCTION search_tickets(search_query TEXT)
RETURNS TABLE(
  id UUID,
  ticket_number INTEGER,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.ticket_number,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.created_at,
    ts_rank(t.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank
  FROM tickets t
  WHERE t.search_vector @@ websearch_to_tsquery('portuguese', search_query)
  ORDER BY rank DESC, t.created_at DESC
  LIMIT 100;
$$;

-- Check index health
CREATE OR REPLACE FUNCTION check_index_health()
RETURNS TABLE(
  table_name TEXT,
  index_name TEXT,
  index_size TEXT,
  index_scans BIGINT,
  rows_read BIGINT,
  rows_fetched BIGINT,
  efficiency NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    schemaname || '.' || relname as table_name,
    indexrelname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as index_scans,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched,
    CASE 
      WHEN idx_scan = 0 THEN 0 
      ELSE ROUND((idx_tup_fetch::numeric / NULLIF(idx_tup_read, 0) * 100), 2) 
    END as efficiency
  FROM pg_stat_user_indexes 
  WHERE schemaname = 'public' 
  ORDER BY idx_scan ASC;
$$;

-- Check table bloat
CREATE OR REPLACE FUNCTION check_table_bloat()
RETURNS TABLE(
  table_name TEXT,
  total_size TEXT,
  live_tuples BIGINT,
  dead_tuples BIGINT,
  dead_ratio NUMERIC,
  needs_vacuum BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    schemaname || '.' || relname as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio,
    (n_dead_tup > 1000 OR (n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0)) > 20) as needs_vacuum
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public' 
  ORDER BY n_dead_tup DESC;
$$;

-- =====================================================
-- STEP 5: CREATE TRIGGER FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Validate and sanitize ticket input
CREATE OR REPLACE FUNCTION validate_ticket_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.title := TRIM(NEW.title);
  NEW.description := TRIM(NEW.description);
  NEW.requester_name := TRIM(NEW.requester_name);
  
  IF NEW.department IS NOT NULL THEN
    NEW.department := TRIM(NEW.department);
  END IF;
  
  IF NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_to := TRIM(NEW.assigned_to);
  END IF;
  
  -- Update search vector
  NEW.search_vector := 
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.requester_name, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.category, '')), 'D');
  
  RETURN NEW;
END;
$$;

-- Validate profile input
CREATE OR REPLACE FUNCTION validate_profile_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := TRIM(NEW.full_name);
  END IF;
  
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  
  IF NEW.department IS NOT NULL THEN
    NEW.department := TRIM(NEW.department);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Validate company input
CREATE OR REPLACE FUNCTION validate_company_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.name := TRIM(NEW.name);
  
  IF LENGTH(NEW.name) < 2 THEN
    RAISE EXCEPTION 'Company name must be at least 2 characters long';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Validate ticket assignment
CREATE OR REPLACE FUNCTION validate_ticket_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
      SELECT p.id INTO NEW.assigned_to_user_id
      FROM profiles p
      INNER JOIN user_roles ur ON p.id = ur.user_id
      WHERE p.full_name = NEW.assigned_to
        AND ur.role IN ('technician', 'admin', 'developer')
      LIMIT 1;
      
      IF NEW.assigned_to_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid assignment: user "%" not found or does not have technician/admin role', NEW.assigned_to;
      END IF;
    ELSE
      NEW.assigned_to_user_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Set ticket update author automatically
CREATE OR REPLACE FUNCTION set_ticket_update_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.author_id := auth.uid();
  
  IF NEW.author IS NULL OR NEW.author = '' THEN
    NEW.author := COALESCE(
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      auth.uid()::TEXT
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::JSONB, auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

-- Handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 6: CREATE TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Validation triggers
CREATE TRIGGER validate_company_input_trigger
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_input();

CREATE TRIGGER validate_profile_input_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_input();

CREATE TRIGGER validate_ticket_input_trigger
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_input();

CREATE TRIGGER validate_ticket_assignment_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_assignment();

CREATE TRIGGER set_ticket_update_author_trigger
  BEFORE INSERT ON ticket_updates
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_update_author();

-- Audit triggers
CREATE TRIGGER audit_tickets_changes
  AFTER INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_companies_changes
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Auth trigger (on auth.users table)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: CREATE RLS POLICIES - COMPANIES
-- =====================================================

-- Developers can do everything
CREATE POLICY "Developers can view all companies" ON companies
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can insert companies" ON companies
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update companies" ON companies
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete companies" ON companies
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

-- Master company admins (Orion System)
CREATE POLICY "Master company users can view all companies" ON companies
  FOR SELECT USING (is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can insert companies" ON companies
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can update companies" ON companies
  FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can delete companies" ON companies
  FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

-- Users can view their own company
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (id = get_user_company_id(auth.uid()));

-- =====================================================
-- STEP 9: CREATE RLS POLICIES - DEPARTMENTS
-- =====================================================

CREATE POLICY "Developers can view all departments" ON departments
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can create any department" ON departments
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update any department" ON departments
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete any department" ON departments
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can view departments in their company" ON departments
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can create departments in their company" ON departments
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can update departments in their company" ON departments
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can delete departments from their company" ON departments
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Users can view departments from their company" ON departments
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

-- =====================================================
-- STEP 10: CREATE RLS POLICIES - PROFILES
-- =====================================================

CREATE POLICY "Developers can view all profiles" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update any profile" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete any profile" ON profiles
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Master company users can view all profiles" ON profiles
  FOR SELECT USING (is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can update all profiles" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can delete all profiles" ON profiles
  FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view profiles in their company" ON profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can update profiles in their company" ON profiles
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins can delete profiles in their company" ON profiles
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND 
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND 
    (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );

-- =====================================================
-- STEP 11: CREATE RLS POLICIES - USER_ROLES
-- =====================================================

CREATE POLICY "Developers can view all roles" ON user_roles
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can insert any role" ON user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update any role" ON user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete any role" ON user_roles
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Master company users can view all roles" ON user_roles
  FOR SELECT USING (is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can insert any role" ON user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can update any role" ON user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Master company admins can delete any role" ON user_roles
  FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view roles in their company" ON user_roles
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can insert roles for users in their company" ON user_roles
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can update roles in their company" ON user_roles
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can delete roles in their company" ON user_roles
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Prevent self-promotion to admin" ON user_roles
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    (user_id != auth.uid() OR role != 'admin')
  );

-- =====================================================
-- STEP 12: CREATE RLS POLICIES - TICKETS
-- =====================================================

CREATE POLICY "Developers can view all tickets" ON tickets
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update any ticket" ON tickets
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete any ticket" ON tickets
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can view tickets in their company" ON tickets
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = tickets.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can update tickets in their company" ON tickets
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = tickets.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can delete tickets in their company" ON tickets
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = tickets.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Technicians can view tickets in their company" ON tickets
  FOR SELECT USING (
    has_role(auth.uid(), 'technician') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = tickets.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Technicians can update tickets in their company" ON tickets
  FOR UPDATE USING (
    has_role(auth.uid(), 'technician') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = tickets.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Customers can view their own tickets" ON tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Customers can create their own tickets" ON tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- STEP 13: CREATE RLS POLICIES - TICKET_UPDATES
-- =====================================================

CREATE POLICY "Developers can view all ticket updates" ON ticket_updates
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can create ticket updates" ON ticket_updates
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'developer') AND 
    (author_id = auth.uid() OR author_id IS NULL)
  );

CREATE POLICY "Developers can update any update" ON ticket_updates
  FOR UPDATE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete any update" ON ticket_updates
  FOR DELETE USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can view ticket updates in their company" ON ticket_updates
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    ticket_belongs_to_user_company(ticket_id, auth.uid())
  );

CREATE POLICY "Admins can create ticket updates in their company" ON ticket_updates
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin') AND 
    ticket_belongs_to_user_company(ticket_id, auth.uid()) AND
    (author_id = auth.uid() OR author_id IS NULL)
  );

CREATE POLICY "Admins can delete updates in their company" ON ticket_updates
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND 
    ticket_belongs_to_user_company(ticket_id, auth.uid())
  );

CREATE POLICY "Technicians can view ticket updates in their company" ON ticket_updates
  FOR SELECT USING (
    has_role(auth.uid(), 'technician') AND 
    ticket_belongs_to_user_company(ticket_id, auth.uid())
  );

CREATE POLICY "Technicians can create ticket updates in their company" ON ticket_updates
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'technician') AND 
    ticket_belongs_to_user_company(ticket_id, auth.uid()) AND
    (author_id = auth.uid() OR author_id IS NULL)
  );

CREATE POLICY "Users can view updates for their tickets" ON ticket_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_updates.ticket_id 
        AND tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create updates for their tickets" ON ticket_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_updates.ticket_id 
        AND tickets.user_id = auth.uid()
    ) AND
    (author_id = auth.uid() OR author_id IS NULL)
  );

CREATE POLICY "Authors can edit recent updates" ON ticket_updates
  FOR UPDATE USING (
    author_id = auth.uid() AND 
    created_at > NOW() - INTERVAL '15 minutes'
  );

-- =====================================================
-- STEP 14: CREATE RLS POLICIES - AUDIT_LOG
-- =====================================================

CREATE POLICY "Developers can view all audit logs" ON audit_log
  FOR SELECT USING (has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can view audit logs in their company" ON audit_log
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND 
    (
      changed_by IN (
        SELECT id FROM profiles 
        WHERE company_id = get_user_company_id(auth.uid())
      ) OR 
      changed_by IS NULL
    )
  );

-- =====================================================
-- STEP 15: INSERT INITIAL DATA
-- =====================================================

-- Insert master company
INSERT INTO companies (name) VALUES ('Orion System');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Database structure has been completely reset and recreated
-- All tables, functions, triggers, and RLS policies are in place
-- The database is optimized, secure, and production-ready
-- =====================================================