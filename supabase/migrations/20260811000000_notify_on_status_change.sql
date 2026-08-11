-- Estende create_notification_on_ticket_update() para também notificar
-- mudanças de status, não apenas comentários.
--
-- Contexto: o MVP de helpdesk exige "notificação básica de mudança de
-- status" (CLAUDE.md), mas o trigger original tinha
--   IF NEW.type != 'comment' THEN RETURN NEW; END IF;
-- e retornava sem inserir nada para ticket_updates.type = 'status_change'.
-- Resultado: quando um técnico mudava o status de um chamado
-- (TicketDetails.tsx -> executeStatusChange), nenhuma linha era criada em
-- `notifications` e o cliente nunca era avisado — só existia um toast
-- local, visível apenas para quem executou a ação.
--
-- Reaproveita a mesma lógica de destinatário já usada para comentários:
--   staff (technician/admin/developer) muda o status -> notifica o dono do chamado
--   cliente reabre o chamado                          -> notifica o técnico responsável
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
  -- Processa comentários e mudanças de status; ignora os demais tipos
  -- (assignment, priority_change etc. seguem fora do escopo do MVP).
  IF NEW.type NOT IN ('comment', 'status_change') THEN
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
    -- Technician/Admin acted -> notify ticket owner
    recipient_id := ticket_record.user_id;
    IF NEW.type = 'status_change' THEN
      notification_title := 'Status do seu chamado foi atualizado';
      notification_message := NEW.author || ' atualizou o chamado #' || ticket_record.ticket_number || ' (' || ticket_record.title || '): ' || NEW.content;
    ELSE
      notification_title := 'Nova resposta no seu chamado';
      notification_message := NEW.author || ' respondeu ao chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
    END IF;
  ELSE
    -- Customer acted -> notify assigned technician (if any)
    IF ticket_record.assigned_to_user_id IS NOT NULL THEN
      recipient_id := ticket_record.assigned_to_user_id;
      IF NEW.type = 'status_change' THEN
        notification_title := 'Cliente atualizou o chamado';
        notification_message := NEW.author || ' ' || lower(NEW.content) || ' no chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
      ELSE
        notification_title := 'Novo comentário do cliente';
        notification_message := NEW.author || ' comentou no chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
      END IF;
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
