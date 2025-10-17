-- Fix existing NULL user_id tickets by assigning to first admin
-- Get first admin user
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Find first admin user
  SELECT user_id INTO admin_user_id
  FROM user_roles
  WHERE role = 'admin'
  LIMIT 1;
  
  -- If admin exists, assign NULL tickets to them
  IF admin_user_id IS NOT NULL THEN
    UPDATE tickets
    SET user_id = admin_user_id
    WHERE user_id IS NULL;
  ELSE
    -- If no admin exists, raise error
    RAISE EXCEPTION 'No admin user found. Please create an admin user first before fixing NULL tickets.';
  END IF;
END $$;

-- Now make user_id NOT NULL
ALTER TABLE tickets 
ALTER COLUMN user_id SET NOT NULL;

-- Fix 2: Prevent ticket_update author spoofing
ALTER TABLE ticket_updates 
ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id);

-- Create trigger to automatically set author_id from authenticated user
CREATE OR REPLACE FUNCTION set_ticket_update_author()
RETURNS TRIGGER AS $$
BEGIN
  -- Set author_id to the authenticated user
  NEW.author_id := auth.uid();
  
  -- For backwards compatibility, keep author field
  -- The application will fetch display name from profiles using author_id
  IF NEW.author IS NULL OR NEW.author = '' THEN
    NEW.author := COALESCE(
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      auth.uid()::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_author_on_ticket_update_insert ON ticket_updates;
CREATE TRIGGER set_author_on_ticket_update_insert
BEFORE INSERT ON ticket_updates
FOR EACH ROW
EXECUTE FUNCTION set_ticket_update_author();

-- Update RLS policy to prevent author manipulation
DROP POLICY IF EXISTS "Authenticated users can create updates for accessible tickets" ON ticket_updates;

CREATE POLICY "Authenticated users can create updates for accessible tickets"
ON ticket_updates FOR INSERT
WITH CHECK (
  -- Must have access to the ticket
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_updates.ticket_id
      AND (
        tickets.user_id = auth.uid()
        OR has_role(auth.uid(), 'technician'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
  -- Author ID must match authenticated user (set by trigger)
  AND (author_id = auth.uid() OR author_id IS NULL)
);

-- Fix 3: Add validation for ticket assignment
-- Store assigned_to as UUID instead of text for proper validation
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES profiles(id);

-- Create function to validate and set assignment
CREATE OR REPLACE FUNCTION validate_ticket_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_to is being changed, validate it
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
      -- Try to find the user by full_name and validate they have technician/admin role
      SELECT p.id INTO NEW.assigned_to_user_id
      FROM profiles p
      INNER JOIN user_roles ur ON p.id = ur.user_id
      WHERE p.full_name = NEW.assigned_to
        AND ur.role IN ('technician', 'admin')
      LIMIT 1;
      
      IF NEW.assigned_to_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid assignment: user "%" not found or does not have technician/admin role', NEW.assigned_to;
      END IF;
    ELSE
      NEW.assigned_to_user_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_assignment_on_ticket_update ON tickets;
CREATE TRIGGER validate_assignment_on_ticket_update
BEFORE UPDATE OF assigned_to ON tickets
FOR EACH ROW
EXECUTE FUNCTION validate_ticket_assignment();