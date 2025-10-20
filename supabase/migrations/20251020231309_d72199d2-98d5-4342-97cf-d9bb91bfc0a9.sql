-- Create departments table for company-specific departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policies for departments
CREATE POLICY "Users can view departments from their company"
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.company_id = departments.company_id
  )
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can create departments for their company"
ON public.departments
FOR INSERT
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = departments.company_id
    )
  )
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can update departments in their company"
ON public.departments
FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = departments.company_id
    )
  )
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete departments from their company"
ON public.departments
FOR DELETE
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = departments.company_id
    )
  )
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- Update profiles RLS policies to allow admins to update users in their company
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR company_id IS NULL
  )
);

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Developers can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();