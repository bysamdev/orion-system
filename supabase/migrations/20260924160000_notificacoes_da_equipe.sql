-- Quem recebe aviso (decisão do Sam, 24/09/2026). Cada notificação vira
-- também push no navegador (20260924100000).
--
-- - Técnicos e gestores (technician, admin, developer) que enxergam o
--   chamado: todo chamado novo e toda atualização (status, resposta do
--   cliente, comentário, nota interna, atribuição, prioridade).
-- - Cliente: só atualizações do próprio chamado feitas pela equipe, sem
--   nota interna (regra que já existia).
-- - Ninguém é avisado do que ele mesmo fez.
-- - Cada técnico/gestor escolhe as categorias em Configurações >
--   Notificações (preferencias_de_notificacao; sem linha = tudo ligado).
--
-- "Enxergam o chamado" segue a RLS: equipe interna (is_equipe_interna) vê
-- todos; técnico/admin de empresa cliente vê os da própria empresa. Conta
-- inativa e usuário de máquina (agente) ficam de fora.

-- Preferências: cada técnico/gestor escolhe o que recebe. Sem linha = tudo
-- ligado. O cliente não tem preferência (recebe só as atualizações do
-- próprio chamado).
CREATE TABLE IF NOT EXISTS public.preferencias_de_notificacao (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  novos_chamados boolean NOT NULL DEFAULT true,
  respostas boolean NOT NULL DEFAULT true,
  mudancas_de_status boolean NOT NULL DEFAULT true,
  notas_internas boolean NOT NULL DEFAULT true,
  atribuicoes boolean NOT NULL DEFAULT true,
  prioridade boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preferencias_de_notificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY preferencias_de_notificacao_select ON public.preferencias_de_notificacao
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY preferencias_de_notificacao_insert ON public.preferencias_de_notificacao
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY preferencias_de_notificacao_update ON public.preferencias_de_notificacao
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.preferencias_de_notificacao TO authenticated;

-- p_categoria: novos_chamados, respostas, mudancas_de_status,
-- notas_internas, atribuicoes ou prioridade.
CREATE OR REPLACE FUNCTION public.equipe_do_chamado(p_ticket_id uuid, p_categoria text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.tickets t ON t.id = p_ticket_id
    LEFT JOIN public.preferencias_de_notificacao pref ON pref.user_id = ur.user_id
   WHERE ur.role IN ('technician', 'admin', 'developer')
     AND coalesce(p.status, 'active') = 'active'
     AND NOT public.eh_usuario_de_maquina(ur.user_id)
     AND (public.is_equipe_interna(ur.user_id) OR p.company_id = t.company_id)
     AND coalesce(CASE p_categoria
           WHEN 'novos_chamados' THEN pref.novos_chamados
           WHEN 'respostas' THEN pref.respostas
           WHEN 'mudancas_de_status' THEN pref.mudancas_de_status
           WHEN 'notas_internas' THEN pref.notas_internas
           WHEN 'atribuicoes' THEN pref.atribuicoes
           WHEN 'prioridade' THEN pref.prioridade
         END, true)
$$;

REVOKE ALL ON FUNCTION public.equipe_do_chamado(uuid, text) FROM PUBLIC, anon, authenticated;

-- Atualizações do chamado ------------------------------------------------
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
   WHERE e IS DISTINCT FROM NEW.author_id;

  RETURN NEW;
END;
$$;

-- Chamado novo ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifica_equipe_chamado_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT e,
         'Novo chamado #' || NEW.ticket_number,
         coalesce(NEW.requester_name, 'Cliente') || ': ' || NEW.title,
         '/ticket/' || NEW.id
    FROM public.equipe_do_chamado(NEW.id, 'novos_chamados') AS e
   WHERE e IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Aviso nunca impede a abertura do chamado.
  RAISE WARNING 'notifica_equipe_chamado_novo: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notifica_equipe_chamado_novo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifica_equipe_chamado_novo ON public.tickets;
CREATE TRIGGER trg_notifica_equipe_chamado_novo
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notifica_equipe_chamado_novo();
