-- Add telemetry and antivirus/security columns for Red Zone monitoring
ALTER TABLE public.machine_hardware ADD COLUMN IF NOT EXISTS security_info jsonb;
ALTER TABLE public.machine_hardware ADD COLUMN IF NOT EXISTS remote_software jsonb;
ALTER TABLE public.machine_hardware ADD COLUMN IF NOT EXISTS battery_info jsonb;
ALTER TABLE public.machine_hardware ADD COLUMN IF NOT EXISTS update_status jsonb;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS domain text;
