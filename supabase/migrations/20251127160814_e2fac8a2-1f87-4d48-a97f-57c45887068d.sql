-- Fix calculate_sla_due_date function to set search_path (security best practice)
CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(ticket_created_at timestamp with time zone, ticket_priority text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  CASE ticket_priority
    WHEN 'urgent' THEN
      RETURN ticket_created_at + INTERVAL '4 hours';
    WHEN 'high' THEN
      RETURN ticket_created_at + INTERVAL '24 hours';
    WHEN 'medium' THEN
      RETURN ticket_created_at + INTERVAL '48 hours';
    WHEN 'low' THEN
      RETURN ticket_created_at + INTERVAL '72 hours';
    ELSE
      RETURN ticket_created_at + INTERVAL '48 hours';
  END CASE;
END;
$$;