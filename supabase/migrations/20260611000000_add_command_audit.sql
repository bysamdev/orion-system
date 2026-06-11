-- ============================================================
-- ORION SYSTEM: Command Audit Trail
-- Adds executed_by_user_id and executed_by_name to machine_commands
-- so the terminal drawer can show who ran each command.
-- ============================================================

ALTER TABLE public.machine_commands
  ADD COLUMN IF NOT EXISTS executed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS executed_by_name TEXT;

-- Index for fast lookups by who ran commands
CREATE INDEX IF NOT EXISTS idx_machine_commands_executed_by
  ON public.machine_commands (executed_by_user_id, created_at DESC);

COMMENT ON COLUMN public.machine_commands.executed_by_user_id IS 'UUID of the technician who dispatched this command';
COMMENT ON COLUMN public.machine_commands.executed_by_name IS 'Snapshot of the technician full name at time of dispatch';
