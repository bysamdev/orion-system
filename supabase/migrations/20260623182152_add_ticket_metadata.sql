-- Add metadata JSONB column to tickets table for future-proofing custom fields
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_tickets_metadata ON tickets USING GIN (metadata);
