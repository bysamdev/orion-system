-- 1. Fix Ticket Ratings RLS to allow users to see their own ratings
DROP POLICY IF EXISTS "Users can rate their own tickets" ON public.ticket_ratings;
DROP POLICY IF EXISTS "Users can see their own ratings" ON public.ticket_ratings;
DROP POLICY IF EXISTS "Technicians and admins can see ratings" ON public.ticket_ratings;

CREATE POLICY "Users can rate their own tickets"
  ON public.ticket_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id
    )
  );

CREATE POLICY "Users can see their own ratings"
  ON public.ticket_ratings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('technician', 'admin', 'developer')
    )
  );

-- 2. (Optional) If queue sync means technicians should only see tickets from their departments
-- You can add policies here or modify existing ones
