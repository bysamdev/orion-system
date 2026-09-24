-- Quem recebe o chamado já ganha "Novo chamado atribuído a você"
-- (notify_ticket_assignment). O aviso de equipe "Chamado #N atribuído"
-- (20260924160000) chegava junto para essa mesma pessoa. Agora ele vai só
-- para o resto da equipe.

CREATE OR REPLACE FUNCTION public.create_notification_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  ticket_record RECORD;
  autor_eh_equipe boolean;
  referencia text;
  titulo_equipe text;
  mensagem_equipe text;
BEGIN
  IF NEW.type NOT IN ('comment', 'status_change', 'assignment', 'priority_change') THEN
    RETURN NEW;
  END IF;

  SELECT t.* INTO ticket_record FROM public.tickets t WHERE t.id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  referencia := '#' || ticket_record.ticket_number || ' (' || ticket_record.title || ')';
  autor_eh_equipe := EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = NEW.author_id AND role IN ('technician', 'admin', 'developer')
  );

  -- Cliente: atualização pública feita pela equipe no chamado dele.
  IF autor_eh_equipe
     AND NOT coalesce(NEW.is_internal, false)
     AND NEW.type IN ('comment', 'status_change', 'assignment')
     AND ticket_record.user_id IS DISTINCT FROM NEW.author_id THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      ticket_record.user_id,
      CASE NEW.type
        WHEN 'assignment' THEN 'Seu chamado está em atendimento'
        WHEN 'status_change' THEN 'Status do seu chamado foi atualizado'
        ELSE 'Nova resposta no seu chamado'
      END,
      CASE NEW.type
        WHEN 'comment' THEN coalesce(NEW.author, 'A equipe') || ' respondeu ao chamado ' || referencia
        ELSE 'Chamado ' || referencia || ': ' || NEW.content
      END,
      '/ticket/' || NEW.ticket_id
    );
  END IF;

  -- Equipe: toda atualização, inclusive nota interna.
  titulo_equipe := CASE
    WHEN NOT autor_eh_equipe AND NEW.type = 'comment' THEN 'Cliente respondeu no chamado #' || ticket_record.ticket_number
    WHEN NOT autor_eh_equipe THEN 'Cliente atualizou o chamado #' || ticket_record.ticket_number
    WHEN coalesce(NEW.is_internal, false) THEN 'Nota interna no chamado #' || ticket_record.ticket_number
    WHEN NEW.type = 'status_change' THEN 'Status alterado no chamado #' || ticket_record.ticket_number
    WHEN NEW.type = 'assignment' THEN 'Chamado #' || ticket_record.ticket_number || ' atribuído'
    WHEN NEW.type = 'priority_change' THEN 'Prioridade alterada no chamado #' || ticket_record.ticket_number
    ELSE 'Nova resposta no chamado #' || ticket_record.ticket_number
  END;
  mensagem_equipe := coalesce(NEW.author, 'Alguém') || ': ' || left(coalesce(NEW.content, ''), 160)
                     || ' — ' || ticket_record.title;

  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT e, titulo_equipe, mensagem_equipe, '/ticket/' || NEW.ticket_id
    FROM public.equipe_do_chamado(
           NEW.ticket_id,
           CASE
             WHEN coalesce(NEW.is_internal, false) THEN 'notas_internas'
             WHEN NEW.type = 'status_change' THEN 'mudancas_de_status'
             WHEN NEW.type = 'assignment' THEN 'atribuicoes'
             WHEN NEW.type = 'priority_change' THEN 'prioridade'
             ELSE 'respostas'
           END) AS e
   WHERE e IS DISTINCT FROM NEW.author_id
     AND NOT (NEW.type = 'assignment' AND e IS NOT DISTINCT FROM ticket_record.assigned_to_user_id);

  RETURN NEW;
END;
$$;
