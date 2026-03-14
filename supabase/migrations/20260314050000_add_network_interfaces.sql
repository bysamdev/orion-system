-- Add network_interfaces column to machine_hardware table
ALTER TABLE public.machine_hardware 
ADD COLUMN IF NOT EXISTS network_interfaces JSONB;

-- Update comments for clarity
COMMENT ON COLUMN public.machine_hardware.network_interfaces IS 'JSON list of network adapters and their IPs/MACs';
