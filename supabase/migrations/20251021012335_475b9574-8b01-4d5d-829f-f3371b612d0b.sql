-- Add UPDATE and DELETE policies for ticket_updates table
-- This allows authors to edit recent updates and admins to manage inappropriate content

-- Allow authors to edit their own updates within 15 minutes
CREATE POLICY "Authors can edit recent updates"
ON public.ticket_updates
FOR UPDATE
USING (
  author_id = auth.uid() 
  AND created_at > now() - interval '15 minutes'
);

-- Allow admins to delete updates from tickets in their company
CREATE POLICY "Admins can delete updates in their company"
ON public.ticket_updates
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM tickets t
    JOIN profiles p ON p.id = t.user_id
    WHERE t.id = ticket_updates.ticket_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- Allow developers to delete any update
CREATE POLICY "Developers can delete any update"
ON public.ticket_updates
FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- Allow developers to update any update
CREATE POLICY "Developers can update any update"
ON public.ticket_updates
FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));