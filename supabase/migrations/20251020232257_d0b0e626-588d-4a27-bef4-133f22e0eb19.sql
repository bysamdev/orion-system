-- Fix #1: Add company scoping to profiles SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

-- Fix #2: Add company scoping to profiles DELETE policy
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles in their company"
ON public.profiles FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can delete any profile"
ON public.profiles FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- Fix #3: Add server-side input validation
-- Add CHECK constraints for profiles
ALTER TABLE profiles 
ADD CONSTRAINT check_full_name_length 
CHECK (full_name IS NULL OR (length(trim(full_name)) >= 2 AND length(trim(full_name)) <= 100));

ALTER TABLE profiles 
ADD CONSTRAINT check_email_length 
CHECK (email IS NULL OR (length(trim(email)) >= 3 AND length(trim(email)) <= 255));

-- Add CHECK constraints for tickets
ALTER TABLE tickets 
ADD CONSTRAINT check_title_length 
CHECK (length(trim(title)) >= 5 AND length(trim(title)) <= 100);

ALTER TABLE tickets 
ADD CONSTRAINT check_description_length 
CHECK (length(trim(description)) >= 20 AND length(trim(description)) <= 1000);

ALTER TABLE tickets 
ADD CONSTRAINT check_requester_name_length 
CHECK (length(trim(requester_name)) >= 2 AND length(trim(requester_name)) <= 100);

-- Add CHECK constraints for companies
ALTER TABLE companies 
ADD CONSTRAINT check_company_name_length 
CHECK (length(trim(name)) >= 2 AND length(trim(name)) <= 200);

-- Add CHECK constraints for departments
ALTER TABLE departments 
ADD CONSTRAINT check_department_name_length 
CHECK (length(trim(name)) >= 2 AND length(trim(name)) <= 100);

-- Add CHECK constraints for ticket_updates
ALTER TABLE ticket_updates 
ADD CONSTRAINT check_update_content_length 
CHECK (length(trim(content)) >= 1 AND length(trim(content)) <= 5000);

-- Create validation trigger function for tickets
CREATE OR REPLACE FUNCTION validate_ticket_input()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace from text fields
  NEW.title := trim(NEW.title);
  NEW.description := trim(NEW.description);
  NEW.requester_name := trim(NEW.requester_name);
  
  IF NEW.department IS NOT NULL THEN
    NEW.department := trim(NEW.department);
  END IF;
  
  IF NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_to := trim(NEW.assigned_to);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to tickets table
CREATE TRIGGER validate_ticket_before_insert
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION validate_ticket_input();

CREATE TRIGGER validate_ticket_before_update
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION validate_ticket_input();

-- Create validation trigger function for profiles
CREATE OR REPLACE FUNCTION validate_profile_input()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace from text fields
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := trim(NEW.full_name);
  END IF;
  
  IF NEW.email IS NOT NULL THEN
    NEW.email := trim(NEW.email);
  END IF;
  
  IF NEW.department IS NOT NULL THEN
    NEW.department := trim(NEW.department);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to profiles table
CREATE TRIGGER validate_profile_before_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION validate_profile_input();

CREATE TRIGGER validate_profile_before_update
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION validate_profile_input();