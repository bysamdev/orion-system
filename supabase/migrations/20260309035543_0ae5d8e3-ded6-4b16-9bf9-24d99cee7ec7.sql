
-- 1. Audit trigger on tickets table (INSERT/UPDATE/DELETE)
CREATE TRIGGER audit_tickets_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 2. Audit trigger on ticket_updates table
CREATE TRIGGER audit_ticket_updates_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_updates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 3. Server-side validation function for ticket priority and status
CREATE OR REPLACE FUNCTION public.validate_ticket_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Validar prioridade
  IF NEW.priority NOT IN ('urgent', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Prioridade inválida: %. Valores permitidos: urgent, high, medium, low', NEW.priority;
  END IF;

  -- Validar status
  IF NEW.status NOT IN ('open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'closed', 'reopened', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido: %. Valores permitidos: open, in-progress, awaiting-customer, awaiting-third-party, resolved, closed, reopened, cancelled', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Trigger to validate ticket fields before insert/update
CREATE TRIGGER trg_validate_ticket_fields
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_fields();
