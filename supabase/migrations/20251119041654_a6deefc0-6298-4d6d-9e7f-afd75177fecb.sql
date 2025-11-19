-- ============================================
-- BLOCO 1: INTEGRIDADE DO BANCO DE DADOS
-- Adicionar Foreign Keys com nomenclatura explícita
-- ============================================

-- 1. TABELA: profiles
-- Relacionamento: profiles -> companies
-- Estratégia: RESTRICT (não permitir deletar empresa com usuários ativos)
ALTER TABLE profiles
ADD CONSTRAINT fk_profiles_company
FOREIGN KEY (company_id) 
REFERENCES companies(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Criar índice para performance em queries de multi-tenancy
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);

-- 2. TABELA: tickets
-- Relacionamento: tickets -> profiles (user_id = solicitante)
-- Estratégia: SET NULL (manter histórico do ticket mesmo se usuário for deletado)
ALTER TABLE tickets
ADD CONSTRAINT fk_tickets_user
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Relacionamento: tickets -> profiles (assigned_to_user_id = técnico responsável)
-- Estratégia: SET NULL (manter histórico de quem foi atribuído)
ALTER TABLE tickets
ADD CONSTRAINT fk_tickets_assigned_user
FOREIGN KEY (assigned_to_user_id) 
REFERENCES profiles(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_user_id ON tickets(assigned_to_user_id);

-- 3. TABELA: ticket_updates
-- Relacionamento: ticket_updates -> tickets
-- Estratégia: CASCADE (sem ticket, updates não fazem sentido)
ALTER TABLE ticket_updates
ADD CONSTRAINT fk_ticket_updates_ticket
FOREIGN KEY (ticket_id) 
REFERENCES tickets(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Relacionamento: ticket_updates -> profiles (author_id)
-- Estratégia: SET NULL (manter histórico do autor mesmo se usuário deletado)
ALTER TABLE ticket_updates
ADD CONSTRAINT fk_ticket_updates_author
FOREIGN KEY (author_id) 
REFERENCES profiles(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_updates_author_id ON ticket_updates(author_id);

-- 4. TABELA: departments
-- Relacionamento: departments -> companies
-- Estratégia: CASCADE (sem empresa, departamentos não fazem sentido)
ALTER TABLE departments
ADD CONSTRAINT fk_departments_company
FOREIGN KEY (company_id) 
REFERENCES companies(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);

-- 5. TABELA: user_roles
-- Relacionamento: user_roles -> profiles
-- Estratégia: CASCADE (sem usuário, roles não fazem sentido)
ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_user
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Criar índice para performance em queries de autorização
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- 6. ATIVAR AUDIT TRIGGERS (rastrear mudanças críticas)
-- Triggers para tabelas principais já existem, garantindo que estão ativos

-- Verificar se trigger de audit existe em tickets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_tickets_changes'
  ) THEN
    CREATE TRIGGER audit_tickets_changes
    AFTER INSERT OR UPDATE OR DELETE ON tickets
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
  END IF;
END $$;

-- Verificar se trigger de audit existe em profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_profiles_changes'
  ) THEN
    CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
  END IF;
END $$;

-- Verificar se trigger de audit existe em user_roles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_user_roles_changes'
  ) THEN
    CREATE TRIGGER audit_user_roles_changes
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
  END IF;
END $$;

-- ============================================
-- FIM DO BLOCO 1
-- ============================================

COMMENT ON CONSTRAINT fk_profiles_company ON profiles IS 'Garante integridade: profiles pertencem a empresas válidas';
COMMENT ON CONSTRAINT fk_tickets_user ON tickets IS 'Mantém histórico: tickets preservados mesmo se usuário deletado';
COMMENT ON CONSTRAINT fk_tickets_assigned_user ON tickets IS 'Mantém histórico: preserva quem foi atribuído';
COMMENT ON CONSTRAINT fk_ticket_updates_ticket ON ticket_updates IS 'Cascata: updates deletados junto com ticket';
COMMENT ON CONSTRAINT fk_ticket_updates_author ON ticket_updates IS 'Mantém histórico: preserva autor do comentário';
COMMENT ON CONSTRAINT fk_departments_company ON departments IS 'Cascata: departamentos deletados junto com empresa';
COMMENT ON CONSTRAINT fk_user_roles_user ON user_roles IS 'Cascata: roles deletados junto com usuário';