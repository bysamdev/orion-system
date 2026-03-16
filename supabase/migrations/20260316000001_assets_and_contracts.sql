-- Migration to add machine monitoring and contract usage tracking

-- Add monitoring fields to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS internal_ip TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_check TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hostname TEXT;

-- Add contract usage tracking
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tickets_limit INTEGER DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tickets_used INTEGER DEFAULT 0;

-- Link tickets to assets (CMDB)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id);

-- Add last_assigned_at to profiles for round-robin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;

-- Trigger to update contract usage when a ticket is resolved
-- We need to find the active contract for the company of the ticket
CREATE OR REPLACE FUNCTION update_contract_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
BEGIN
  -- Only count when ticket is moved to 'resolved' or 'closed' for the first time
  IF (NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed')) THEN
    -- Find the active contract for the company
    SELECT id INTO v_contract_id
    FROM contracts
    WHERE company_id = (SELECT company_id FROM profiles WHERE id = NEW.user_id LIMIT 1)
      AND is_active = true
      AND (end_date IS NULL OR end_date > NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_contract_id IS NOT NULL THEN
      UPDATE contracts
      SET tickets_used = tickets_used + 1
      WHERE id = v_contract_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_contract_usage ON tickets;
CREATE TRIGGER tr_update_contract_usage
AFTER UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_contract_usage();
