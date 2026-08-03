CREATE OR REPLACE FUNCTION notify_ticket_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id 
     AND NEW.assigned_to_user_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, title, message, link, is_read
    ) VALUES (
      NEW.assigned_to_user_id,
      'Novo chamado atribuído a você',
      'O chamado #' || NEW.ticket_number || ' foi atribuído a você.',
      '/ticket/' || NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_assignment ON tickets;
CREATE TRIGGER trg_notify_assignment
AFTER UPDATE OF assigned_to_user_id ON tickets
FOR EACH ROW
EXECUTE FUNCTION notify_ticket_assignment();
