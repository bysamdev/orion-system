-- Notificações de andamento do chamado.
--
-- ORN-BUG-05: nota interna (is_internal = true) gerava notificação para o
-- cliente ("Nova resposta no seu chamado") e, em mudança de status interna,
-- o texto da nota ia junto na notificação. Havia 5 notas internas no banco.
-- Agora nota interna não notifica ninguém de fora da equipe.
--
-- ORN-BUG-06: assumir o chamado (aberto -> em atendimento) grava um
-- ticket_update do tipo 'assignment', que o gatilho ignorava. O cliente não
-- era avisado da principal mudança de status do fluxo, requisito do MVP.
-- Agora 'assignment' notifica o solicitante.
--
-- O papel do autor passa a ser o mais alto dele (o LIMIT 1 sem ordem pegava
-- qualquer um quando a pessoa tinha dois papéis).

CREATE OR REPLACE FUNCTION public.create_notification_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ticket_record RECORD;
  author_role text;
  recipient_id uuid;
  notification_title text;
  notification_message text;
BEGIN
  IF NEW.type NOT IN ('comment', 'status_change', 'assignment') THEN
    RETURN NEW;
  END IF;

  -- Nota interna é conversa da equipe: não sai para o cliente.
  IF coalesce(NEW.is_internal, false) THEN
    RETURN NEW;
  END IF;

  SELECT t.*, p.full_name AS requester_full_name
  INTO ticket_record
  FROM tickets t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'assignment' THEN
    recipient_id := ticket_record.user_id;
    notification_title := 'Seu chamado está em atendimento';
    notification_message := 'Chamado #' || ticket_record.ticket_number || ' (' || ticket_record.title || '): ' || NEW.content;
  ELSE
    SELECT role::text INTO author_role
    FROM user_roles
    WHERE user_id = NEW.author_id
    ORDER BY CASE role::text WHEN 'developer' THEN 1 WHEN 'admin' THEN 2 WHEN 'technician' THEN 3 ELSE 4 END
    LIMIT 1;

    IF author_role IN ('technician', 'admin', 'developer') THEN
      recipient_id := ticket_record.user_id;
      IF NEW.type = 'status_change' THEN
        notification_title := 'Status do seu chamado foi atualizado';
        notification_message := NEW.author || ' atualizou o chamado #' || ticket_record.ticket_number || ' (' || ticket_record.title || '): ' || NEW.content;
      ELSE
        notification_title := 'Nova resposta no seu chamado';
        notification_message := NEW.author || ' respondeu ao chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
      END IF;
    ELSE
      IF ticket_record.assigned_to_user_id IS NULL THEN
        RETURN NEW;
      END IF;
      recipient_id := ticket_record.assigned_to_user_id;
      IF NEW.type = 'status_change' THEN
        notification_title := 'Cliente atualizou o chamado';
        notification_message := NEW.author || ' ' || lower(NEW.content) || ' no chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
      ELSE
        notification_title := 'Novo comentário do cliente';
        notification_message := NEW.author || ' comentou no chamado #' || ticket_record.ticket_number || ': ' || ticket_record.title;
      END IF;
    END IF;
  END IF;

  IF recipient_id IS NULL OR recipient_id IS NOT DISTINCT FROM NEW.author_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, title, message, link)
  VALUES (recipient_id, notification_title, notification_message, '/ticket/' || NEW.ticket_id);

  RETURN NEW;
END;
$$;
