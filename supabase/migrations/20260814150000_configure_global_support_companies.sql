-- =================================================================================
-- Migration: Configure Global Support Companies (iBReady, Orion System, bysamdev)
-- Description:
--   1. Expands `is_master_company_user` to recognize iBReady, Orion System, and bysamdev
--      as global IT support companies with cross-tenant visibility.
--   2. Grants master company technicians full visibility to view tickets and history.
-- =================================================================================

-- 1. Update is_master_company_user function
CREATE OR REPLACE FUNCTION public.is_master_company_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id 
      AND (
        c.name ILIKE '%iBReady%'
        OR c.name ILIKE '%Orion System%'
        OR c.name ILIKE '%bysamdev%'
        OR c.name ILIKE '%Bysamdev Sistemas%'
        OR ur.role = 'developer'::app_role
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_master_company_user(uuid) TO authenticated, service_role;

-- 2. Update select_tickets policy to ensure global technicians and admins can view all tickets
DROP POLICY IF EXISTS "select_tickets" ON public.tickets;

CREATE POLICY "select_tickets" ON public.tickets
FOR SELECT USING (
  user_id = auth.uid()
  OR assigned_to_user_id = auth.uid()
  OR (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'technician'))
  )
  OR has_role(auth.uid(), 'developer')
  OR (
    is_master_company_user(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'technician'))
  )
);

-- 3. Update ticket_status_history for master technicians
DROP POLICY IF EXISTS "Master technicians can view all status history" ON public.ticket_status_history;

CREATE POLICY "Master technicians can view all status history" ON public.ticket_status_history
FOR SELECT USING (
  has_role(auth.uid(), 'technician') AND is_master_company_user(auth.uid())
);

-- 4. Update ticket_updates for master technicians
DROP POLICY IF EXISTS "Master technicians can view all ticket updates" ON public.ticket_updates;

CREATE POLICY "Master technicians can view all ticket updates" ON public.ticket_updates
FOR SELECT USING (
  has_role(auth.uid(), 'technician') AND is_master_company_user(auth.uid())
);
