-- Fix company assignment enforcement for multi-tenant isolation

-- Step 1: Assign orphaned profiles to Orion System (default company)
UPDATE profiles 
SET company_id = (SELECT id FROM companies WHERE name = 'Orion System' LIMIT 1)
WHERE company_id IS NULL;

-- Step 2: Update handle_new_user trigger to always assign a company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Step 3: Make company_id NOT NULL to enforce multi-tenant isolation
ALTER TABLE profiles 
ALTER COLUMN company_id SET NOT NULL;

-- Step 4: Add trigger to prevent unauthorized company changes
CREATE OR REPLACE FUNCTION public.validate_company_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Create trigger for company assignment validation
DROP TRIGGER IF EXISTS validate_company_assignment_trigger ON profiles;
CREATE TRIGGER validate_company_assignment_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_assignment();