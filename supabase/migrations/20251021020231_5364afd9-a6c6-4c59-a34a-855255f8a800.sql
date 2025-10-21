-- Fix recursive RLS policies on ticket_updates table
-- Create a helper function to check if a ticket belongs to a user's company

CREATE OR REPLACE FUNCTION public.ticket_belongs_to_user_company(_ticket_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
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
  )
$$;

-- Drop and recreate the problematic policies on ticket_updates
DROP POLICY IF EXISTS "Admins can create ticket updates in their company" ON public.ticket_updates;
DROP POLICY IF EXISTS "Admins can delete updates in their company" ON public.ticket_updates;
DROP POLICY IF EXISTS "Admins can view ticket updates in their company" ON public.ticket_updates;
DROP POLICY IF EXISTS "Technicians can create ticket updates in their company" ON public.ticket_updates;
DROP POLICY IF EXISTS "Technicians can view ticket updates in their company" ON public.ticket_updates;

-- Recreate policies using the helper function
CREATE POLICY "Admins can create ticket updates in their company"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Admins can delete updates in their company"
ON public.ticket_updates
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Admins can view ticket updates in their company"
ON public.ticket_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Technicians can create ticket updates in their company"
ON public.ticket_updates
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
  AND (author_id = auth.uid() OR author_id IS NULL)
);

CREATE POLICY "Technicians can view ticket updates in their company"
ON public.ticket_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);