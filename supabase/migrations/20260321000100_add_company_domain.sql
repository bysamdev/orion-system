-- Add domain column to companies table for multi-tenancy
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS domain TEXT UNIQUE;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.domain IS 'Network domain (e.g. contoso.com) associated with the company for machine and ticket grouping';
