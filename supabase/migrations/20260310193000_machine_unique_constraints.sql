-- ============================================================
-- Migration: Add UNIQUE constraints required for heartbeat upsert
-- ============================================================

-- Garante que o upsert do heartbeat possa usar ON CONFLICT (hostname)
ALTER TABLE public.machines
  ADD CONSTRAINT machines_hostname_key UNIQUE (hostname);

-- Garante que cada máquina tenha somente um registro de hardware
ALTER TABLE public.machine_hardware
  ADD CONSTRAINT machine_hardware_machine_id_key UNIQUE (machine_id);
