-- Add optimized indices for faster queries

-- 1. Índices para filtros comuns em tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id ON tickets(assigned_to_user_id);

-- 2. Índices para ordenação e busca por data
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at_desc ON tickets(updated_at DESC);

-- 3. Índices compostos para queries mais complexas
CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status ON tickets(assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;

-- 4. Índices para profiles (joins frequentes)
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);

-- 5. Índices para ticket_updates
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_updates_created_at ON ticket_updates(created_at DESC);

-- 6. Índice para user_roles (verificações de permissão)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- 7. Habilitar realtime para tickets e ticket_updates
ALTER TABLE tickets REPLICA IDENTITY FULL;
ALTER TABLE ticket_updates REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_updates;