-- ============================================
-- CORREÇÃO DE SEGURANÇA: Function Search Path
-- Adicionar search_path em funções antigas
-- ============================================

-- Corrigir funções que não têm search_path definido

-- 1. validate_ticket_input
CREATE OR REPLACE FUNCTION public.validate_ticket_input()
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

-- 2. validate_profile_input
CREATE OR REPLACE FUNCTION public.validate_profile_input()
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

-- 3. validate_company_input
CREATE OR REPLACE FUNCTION public.validate_company_input()
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

-- 4. validate_ticket_assignment
CREATE OR REPLACE FUNCTION public.validate_ticket_assignment()
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

-- 5. set_ticket_update_author
CREATE OR REPLACE FUNCTION public.set_ticket_update_author()
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

-- 6. validate_company_assignment
CREATE OR REPLACE FUNCTION public.validate_company_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow company_id changes only for master admins or developers
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())) 
       AND NOT has_role(auth.uid(), 'developer'::app_role) THEN
      RAISE EXCEPTION 'Only master admins can change user company assignments';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. audit_trigger_function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
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

-- 8. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_company_id uuid;
BEGIN
  -- Get the Orion System company ID (default company for new users)
  SELECT id INTO default_company_id 
  FROM companies 
  WHERE name = 'Orion System' 
  LIMIT 1;
  
  -- If Orion System doesn't exist, fail the user creation
  IF default_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create user: default company "Orion System" not found';
  END IF;
  
  -- Create profile with company assignment
  INSERT INTO profiles (id, full_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    default_company_id
  );
  
  -- Create user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- 9. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

COMMENT ON FUNCTION public.validate_ticket_input() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.validate_profile_input() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.validate_company_input() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.validate_ticket_assignment() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.set_ticket_update_author() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.validate_company_assignment() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.audit_trigger_function() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.handle_new_user() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Segurança: search_path fixado para prevenir injection';