-- Extra Performance Indexes mapped from requirements to real schema names
-- 1. Mapped notifications(user_id, read, created_at DESC) -> notifications(user_id, is_read, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_notifications_user 
ON public.notifications(user_id, is_read, created_at DESC);

-- 2. Mapped assets(empresa_id, status) -> machines(company_id, status)
CREATE INDEX IF NOT EXISTS idx_machines_company_status 
ON public.machines(company_id, status);

-- Note: The following indexes requested are already present in the database:
-- - tickets(company_id, status) as idx_tickets_company_status
-- - tickets(created_at DESC) as idx_tickets_created_at
-- - tickets(assigned_to) as idx_tickets_assigned_to
