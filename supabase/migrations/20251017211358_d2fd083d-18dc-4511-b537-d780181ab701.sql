-- Performance Optimizations: Add indexes for common queries
-- These indexes will improve query performance significantly

-- Index for tickets filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user ON tickets(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;

-- Index for ticket_updates sorting
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_created ON ticket_updates(ticket_id, created_at);

-- Index for profiles company lookup
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id) WHERE company_id IS NOT NULL;

-- Index for user_roles role filtering
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Analyze tables to update statistics for query planner
ANALYZE tickets;
ANALYZE ticket_updates;
ANALYZE profiles;
ANALYZE user_roles;

-- Add comments for documentation
COMMENT ON INDEX idx_tickets_status_created IS 'Optimizes dashboard queries filtering by status and sorting by date';
COMMENT ON INDEX idx_tickets_user_status IS 'Optimizes user-specific ticket queries';
COMMENT ON INDEX idx_ticket_updates_ticket_created IS 'Optimizes ticket history queries';
COMMENT ON INDEX idx_profiles_company IS 'Optimizes company-based user queries';