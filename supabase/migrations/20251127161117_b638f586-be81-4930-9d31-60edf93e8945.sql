-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS Policies: Users can only see and manage their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- System can insert notifications (via trigger with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Function to create notification on ticket update
CREATE OR REPLACE FUNCTION public.create_notification_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_record RECORD;
  author_role text;
  recipient_id uuid;
  notification_title text;
  notification_message text;
  notification_link text;
BEGIN
  -- Only process comments (not status changes)
  IF NEW.type != 'comment' THEN
    RETURN NEW;
  END IF;
  
  -- Get ticket info
  SELECT t.*, p.full_name as requester_full_name
  INTO ticket_record
  FROM tickets t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.id = NEW.ticket_id;
  
  -- Get author role
  SELECT role INTO author_role
  FROM user_roles
  WHERE user_id = NEW.author_id
  LIMIT 1;
  
  -- Determine recipient based on author role
  IF author_role IN ('technician', 'admin', 'developer') THEN
    -- Technician/Admin commented -> notify ticket owner
    recipient_id := ticket_record.user_id;
    notification_title := 'Nova resposta no seu chamado';
    notification_message := NEW.author || ' respondeu ao chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
  ELSE
    -- Customer commented -> notify assigned technician (if any)
    IF ticket_record.assigned_to_user_id IS NOT NULL THEN
      recipient_id := ticket_record.assigned_to_user_id;
      notification_title := 'Novo comentário do cliente';
      notification_message := NEW.author || ' comentou no chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
    ELSE
      -- No assigned technician, don't create notification
      RETURN NEW;
    END IF;
  END IF;
  
  -- Don't notify yourself
  IF recipient_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  
  -- Build link
  notification_link := '/ticket/' || NEW.ticket_id;
  
  -- Insert notification
  INSERT INTO notifications (user_id, title, message, link)
  VALUES (recipient_id, notification_title, notification_message, notification_link);
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_notification_on_ticket_update
AFTER INSERT ON public.ticket_updates
FOR EACH ROW
EXECUTE FUNCTION public.create_notification_on_ticket_update();