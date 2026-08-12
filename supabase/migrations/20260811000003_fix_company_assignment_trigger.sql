-- Migration: 20260811000003_fix_company_assignment_trigger.sql
-- Description: Allow service_role key to manage company_id in validate_company_assignment and honor metadata company_id in handle_new_user

CREATE OR REPLACE FUNCTION validate_company_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow service role (e.g. edge functions using service role key) to bypass check
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_company_id uuid;
  target_company_id uuid;
BEGIN
  -- Check if company_id was provided in user metadata
  IF NEW.raw_user_meta_data->>'company_id' IS NOT NULL AND NEW.raw_user_meta_data->>'company_id' != '' THEN
    target_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  ELSE
    -- Get the Orion System company ID (default company for new users)
    SELECT id INTO default_company_id 
    FROM companies 
    WHERE name = 'Orion System' 
    LIMIT 1;
    
    target_company_id := default_company_id;
  END IF;
  
  -- Create profile with company assignment
  INSERT INTO profiles (id, full_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    target_company_id
  );
  
  -- Create user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;
