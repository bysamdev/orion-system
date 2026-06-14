-- Performance Optimization Indexes
-- Created based on database performance audit to resolve seq_scans and slow queries

-- 1. Notifications: Index for retrieving user notifications sorted by date (e.g. for /notifications page)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

-- 2. Tickets: Composite index for company-wide ticket listings with pagination (company filter + created_at desc sort)
CREATE INDEX IF NOT EXISTS idx_tickets_company_created 
ON public.tickets(company_id, created_at DESC);

-- 3. Ticket Updates (Comments): Index for fetching conversation updates in chronological order
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_created 
ON public.ticket_updates(ticket_id, created_at ASC);

-- 4. Machines: Index for group-based machine filtering and sorting by hostname
CREATE INDEX IF NOT EXISTS idx_machines_group_hostname 
ON public.machines(group_id, hostname);
