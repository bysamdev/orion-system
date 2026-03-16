-- Migration: Fix Ticket Status Enum Check Constraint
-- This migration updates the valid statuses for a ticket to include missing values like awaiting-customer.

ALTER TABLE public.tickets 
DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_status_check 
CHECK (status IN ('open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'closed', 'reopened', 'cancelled'));

COMMENT ON CONSTRAINT tickets_status_check ON public.tickets IS 
'Status válidos: open, in-progress, awaiting-customer, awaiting-third-party, resolved, closed, reopened, cancelled';
