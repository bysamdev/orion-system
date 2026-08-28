-- =================================================================================
-- Migration: 20260828000000_fix_notify_trigger_null_ticket_user.sql
-- Descrição: create_notification_on_ticket_update() faz
--   SELECT t.*, p.full_name INTO ticket_record
--   FROM tickets t JOIN profiles p ON p.id = t.user_id
--   WHERE t.id = NEW.ticket_id;
-- Como tickets.user_id é nullable, um chamado com user_id NULL faz esse JOIN
-- não casar nenhuma linha -- ticket_record fica inteiro NULL (sem erro
-- ainda), mas o INSERT INTO notifications (user_id NOT NULL) que vem depois
-- estoura violação de constraint com recipient_id NULL. A exceção não
-- tratada reverte TODA a transação do trigger -- qualquer comentário ou
-- mudança de status nesse chamado específico trava com erro bruto do
-- Postgres, sem nenhuma pista pro usuário.
--
-- Correção: se o ticket/perfil não for encontrado, apenas pula a
-- notificação (RETURN NEW) em vez de deixar recipient_id chegar NULL no
-- INSERT. Mesmo padrão de fail-safe já usado logo abaixo pra "sem técnico
-- atribuído".
-- =================================================================================

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
  IF NEW.type NOT IN ('comment', 'status_change') THEN
    RETURN NEW;
  END IF;

  SELECT t.*, p.full_name as requester_full_name
  INTO ticket_record
  FROM tickets t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.id = NEW.ticket_id;

  -- Chamado sem user_id (ou usuário sem profile correspondente): sem dono
  -- pra notificar via este caminho. Sai sem tentar montar a notificação em
  -- vez de deixar ticket_record NULL vazar até o INSERT.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT role INTO author_role
  FROM user_roles
  WHERE user_id = NEW.author_id
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
      RETURN NEW;
    END IF;
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  notification_link := '/ticket/' || NEW.ticket_id;

  INSERT INTO notifications (user_id, title, message, link)
  VALUES (recipient_id, notification_title, notification_message, notification_link);

  RETURN NEW;
END;
$$;
