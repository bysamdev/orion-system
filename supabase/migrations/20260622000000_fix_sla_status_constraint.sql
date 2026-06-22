-- Migration: Fix sla_status check constraint to include 'warning' status
-- This dynamically finds the auto-generated check constraint name and replaces it.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'tickets' 
          AND ccu.column_name = 'sla_status'
          AND tc.constraint_type = 'CHECK'
    LOOP
        EXECUTE 'ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_sla_status_check
  CHECK (sla_status IN ('ok', 'warning', 'attention', 'breached'));

COMMENT ON CONSTRAINT tickets_sla_status_check ON public.tickets IS 
'Status de SLA válidos: ok, warning, attention, breached';
