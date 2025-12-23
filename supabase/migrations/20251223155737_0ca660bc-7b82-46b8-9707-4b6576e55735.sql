-- Atualizar função calculate_sla_due_date com os novos valores de SLA
CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(ticket_priority text, ticket_created_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  sla_hours INTEGER;
BEGIN
  -- Mapear prioridade para horas de SLA (horas corridas)
  CASE ticket_priority
    WHEN 'urgent' THEN sla_hours := 2;   -- Urgente: 2 horas
    WHEN 'high' THEN sla_hours := 4;     -- Alta: 4 horas
    WHEN 'medium' THEN sla_hours := 24;  -- Média: 24 horas
    WHEN 'low' THEN sla_hours := 48;     -- Baixa: 48 horas
    ELSE sla_hours := 24; -- Default: 24 horas
  END CASE;

  -- Retornar data de criação + horas do SLA
  RETURN ticket_created_at + (sla_hours || ' hours')::INTERVAL;
END;
$function$;