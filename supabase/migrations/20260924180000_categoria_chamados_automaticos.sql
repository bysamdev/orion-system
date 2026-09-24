-- Decisão do Sam (24/09/2026): chamado aberto automaticamente pelo
-- monitoramento (alerta de servidor) vira categoria própria nas
-- preferências, em vez de contar como "chamado novo". Identificação: o que
-- lib/monitoring.go grava (metadata.auto_generated) ou dono sendo o
-- usuário-fantasma de uma máquina.

ALTER TABLE public.preferencias_de_notificacao
  ADD COLUMN IF NOT EXISTS chamados_automaticos boolean NOT NULL DEFAULT true;

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
           WHEN 'chamados_automaticos' THEN pref.chamados_automaticos
           WHEN 'respostas' THEN pref.respostas
           WHEN 'mudancas_de_status' THEN pref.mudancas_de_status
           WHEN 'notas_internas' THEN pref.notas_internas
           WHEN 'atribuicoes' THEN pref.atribuicoes
           WHEN 'prioridade' THEN pref.prioridade
         END, true)
$$;

CREATE OR REPLACE FUNCTION public.notifica_equipe_chamado_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  automatico boolean := coalesce((NEW.metadata ->> 'auto_generated')::boolean, false)
                        OR public.eh_usuario_de_maquina(NEW.user_id);
BEGIN
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT e,
         CASE WHEN automatico THEN 'Alerta automático: chamado #' ELSE 'Novo chamado #' END || NEW.ticket_number,
         coalesce(NEW.requester_name, 'Cliente') || ': ' || NEW.title,
         '/ticket/' || NEW.id
    FROM public.equipe_do_chamado(NEW.id, CASE WHEN automatico THEN 'chamados_automaticos' ELSE 'novos_chamados' END) AS e
   WHERE e IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notifica_equipe_chamado_novo: %', SQLERRM;
  RETURN NEW;
END;
$$;
