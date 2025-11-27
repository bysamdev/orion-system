-- Fix the original calculate_sla_due_date function to set search_path
-- Drop the duplicate function created with different argument order
DROP FUNCTION IF EXISTS public.calculate_sla_due_date(timestamp with time zone, text);

-- Replace the original function with proper search_path setting
CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(ticket_priority text, ticket_created_at timestamp with time zone)
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  sla_hours INTEGER;
BEGIN
  -- Mapear prioridade para horas de SLA
  CASE ticket_priority
    WHEN 'urgent' THEN sla_hours := 4;   -- Urgente: 4 horas
    WHEN 'high' THEN sla_hours := 24;    -- Alta: 24 horas
    WHEN 'medium' THEN sla_hours := 48;  -- Média: 48 horas
    WHEN 'low' THEN sla_hours := 72;     -- Baixa: 72 horas
    ELSE sla_hours := 48; -- Default: 48 horas
  END CASE;

  -- Retornar data de criação + horas do SLA
  RETURN ticket_created_at + (sla_hours || ' hours')::INTERVAL;
END;
$$;