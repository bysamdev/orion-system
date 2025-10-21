-- Add server-side validation for company names
-- This prevents attackers from bypassing client-side validation

-- Add CHECK constraint to ensure company names are properly validated
ALTER TABLE public.companies
ADD CONSTRAINT companies_name_length_check 
CHECK (length(trim(name)) >= 2 AND length(name) <= 100);

-- Add a trigger to automatically trim company names on insert/update
CREATE OR REPLACE FUNCTION public.validate_company_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trim whitespace from company name
  NEW.name := trim(NEW.name);
  
  -- Additional validation: ensure name is not just whitespace
  IF length(NEW.name) < 2 THEN
    RAISE EXCEPTION 'Company name must be at least 2 characters long';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for company name validation
CREATE TRIGGER validate_company_name
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.validate_company_input();