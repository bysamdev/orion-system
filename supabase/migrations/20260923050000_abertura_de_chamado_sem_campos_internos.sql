-- ORN-SEC-15: quem não é equipe interna não escolhe campos internos ao abrir
-- chamado.
--
-- A policy de INSERT em tickets confere só dono, empresa e avaliação
-- pendente; o resto vinha do cliente. Um cliente conseguia abrir chamado já
-- resolvido ou fechado, com responsável escolhido, data de criação no passado
-- (distorcendo SLA e relatórios) e, principalmente, com metadata.automacoes
-- preenchido: quando nenhuma regra casava, o motor de automações
-- (tr_automacoes_pos_abertura, SECURITY DEFINER) executava as ações que o
-- próprio cliente escreveu, como notificar qualquer usuário de qualquer
-- empresa ou publicar resposta com autor forjado.
--
-- O gatilho roda antes de todos os outros de INSERT (nome começa com "aa_").
-- Vale só para chamada com sessão de usuário que não é equipe interna; o
-- backend (service role, sem auth.uid) e a equipe interna seguem como antes.

CREATE OR REPLACE FUNCTION public.sanitiza_abertura_de_chamado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_equipe_interna(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.status := 'open';
  NEW.assigned_to_user_id := NULL;
  NEW.assigned_to := NULL;
  NEW.created_at := now();
  NEW.first_response_at := NULL;
  NEW.resolved_at := NULL;
  NEW.closed_at := NULL;
  NEW.cancelled_at := NULL;
  NEW.sla_due_date := NULL;
  NEW.sla_status := NULL;
  NEW.sla_paused_at := NULL;
  NEW.sla_accumulated_pause_minutes := 0;
  NEW.resolution_notes := NULL;
  NEW.satisfaction_rating := NULL;
  NEW.satisfaction_comment := NULL;
  NEW.avaliacao_email_enviada_em := NULL;
  -- Chaves que só o sistema escreve. O resto de metadata (ex.: respostas do
  -- formulário de abertura) é do cliente e fica.
  NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) - 'automacoes' - 'merged_into' - 'fechado_por_inatividade';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sanitiza_abertura_de_chamado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_sanitiza_abertura_de_chamado ON public.tickets;
CREATE TRIGGER aa_sanitiza_abertura_de_chamado
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.sanitiza_abertura_de_chamado();
