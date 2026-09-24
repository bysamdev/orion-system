-- Assumir um chamado que já é seu e está em atendimento não repete histórico nem notificação.
CREATE OR REPLACE FUNCTION public.assumir_chamado(p_ticket_id uuid, p_user_name text, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS tickets
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ticket public.tickets;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets
   WHERE id = p_ticket_id AND assigned_to_user_id = auth.uid() AND status = 'in-progress';
  IF FOUND THEN RETURN v_ticket; END IF;

  UPDATE public.tickets SET assigned_to = p_user_name, assigned_to_user_id = auth.uid(), status = 'in-progress'
   WHERE id = p_ticket_id AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
   RETURNING * INTO v_ticket;
  IF NOT FOUND THEN PERFORM public.falhar_comando_chamado(p_ticket_id); END IF;
  INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
  VALUES (p_ticket_id, format('Chamado assumido por %s (Status alterado para: Em Atendimento)', p_user_name), 'assignment', '', false);
  RETURN v_ticket;
END; $function$;
