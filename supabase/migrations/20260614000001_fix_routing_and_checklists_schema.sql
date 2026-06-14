-- Fix routing_rules schema to match frontend expectations
ALTER TABLE public.routing_rules
  DROP COLUMN IF EXISTS condition_category,
  DROP COLUMN IF EXISTS condition_priority,
  DROP COLUMN IF EXISTS condition_company_id,
  DROP COLUMN IF EXISTS action_type,
  DROP COLUMN IF EXISTS action_target_user_id,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '{}'::jsonb;

-- Fix resolution_checklists schema to match frontend expectations
ALTER TABLE public.resolution_checklists
  RENAME COLUMN steps TO items;

