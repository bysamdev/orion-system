-- Aviso de chamado novo passa a vir desligado: quem quiser liga em Configurações.
-- As demais categorias continuam ligadas por padrão.
ALTER TABLE public.preferencias_de_notificacao ALTER COLUMN novos_chamados SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.equipe_do_chamado(p_ticket_id uuid, p_categoria text)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.tickets t ON t.id = p_ticket_id
    LEFT JOIN public.preferencias_de_notificacao pref ON pref.user_id = ur.user_id
   WHERE ur.role IN ('technician', 'admin', 'developer')
     AND coalesce(p.status, 'active') = 'active'
     AND NOT public.eh_usuario_de_maquina(ur.user_id)
     AND (public.is_equipe_interna(ur.user_id) OR p.company_id = t.company_id)
     AND CASE p_categoria
           WHEN 'novos_chamados' THEN coalesce(pref.novos_chamados, false)
           WHEN 'chamados_automaticos' THEN coalesce(pref.chamados_automaticos, true)
           WHEN 'respostas' THEN coalesce(pref.respostas, true)
           WHEN 'mudancas_de_status' THEN coalesce(pref.mudancas_de_status, true)
           WHEN 'notas_internas' THEN coalesce(pref.notas_internas, true)
           WHEN 'atribuicoes' THEN coalesce(pref.atribuicoes, true)
           WHEN 'prioridade' THEN coalesce(pref.prioridade, true)
           ELSE true
         END
$function$;
