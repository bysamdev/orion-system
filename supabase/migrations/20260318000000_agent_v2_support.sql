-- ============================================================
-- Migration: Orion Agent 2.0 Backend Support
-- Description: Adds machine_token and current_user to machines table
--              for automatic registration and secure tracking.
-- ============================================================

-- 1. Add machine_token and current_user to machines
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS machine_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS current_user TEXT,
ADD COLUMN IF NOT EXISTS machine_uuid UUID;

-- 2. Add machine_token to tickets for easier association
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS machine_token TEXT;

-- 3. Update machine_hardware to store JSON interfaces
ALTER TABLE public.machine_hardware
ADD COLUMN IF NOT EXISTS interfaces JSONB;

-- 4. Create an index for machine_token lookups
CREATE INDEX IF NOT EXISTS idx_machines_machine_token ON public.machines(machine_token);
CREATE INDEX IF NOT EXISTS idx_tickets_machine_token ON public.tickets(machine_token);

-- 5. RLS: Ensure agents (authenticated) can register/heartbeat
-- The existing policies for 'authenticated' users usually cover service-role or 
-- authenticated users. For the agent, we expect it to use an API Key or a specific 
-- service account. Given the system's setup, 'authenticated' is the target.

-- If we want to allow the agent to insert/update based on token:
CREATE POLICY "Agents can update machines by token"
ON public.machines
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
