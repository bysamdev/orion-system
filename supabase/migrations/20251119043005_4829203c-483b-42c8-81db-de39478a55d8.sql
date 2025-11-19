-- ============================================
-- BLOCO 3: OTIMIZAÇÃO MULTI-TENANCY E PERFORMANCE
-- Desnormalização segura + RLS otimizado
-- ============================================

-- PASSO 1: Adicionar coluna company_id (nullable inicialmente)
ALTER TABLE tickets 
ADD COLUMN company_id UUID;

-- PASSO 2: Preencher company_id dos tickets existentes
UPDATE tickets t
SET company_id = p.company_id
FROM profiles p
WHERE t.user_id = p.id;

-- PASSO 3: Tornar coluna NOT NULL e adicionar Foreign Key
ALTER TABLE tickets 
ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE tickets
ADD CONSTRAINT fk_tickets_company 
FOREIGN KEY (company_id) 
REFERENCES companies(id) 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

-- PASSO 4: Criar índice de performance
CREATE INDEX idx_tickets_company_id ON tickets(company_id);
CREATE INDEX idx_tickets_company_status ON tickets(company_id, status);

-- PASSO 5: Trigger para auto-preencher company_id na criação
CREATE OR REPLACE FUNCTION set_ticket_company_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Buscar company_id do usuário autenticado
  SELECT company_id INTO NEW.company_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- Se não encontrou, bloquear criação
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada não pode criar tickets';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_ticket_company
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_company_from_user();

-- ============================================
-- PASSO 6: REESCREVER RLS POLICIES (SEM JOINS)
-- ============================================

-- Remover policies antigas
DROP POLICY IF EXISTS "Customers can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Customers can create their own tickets" ON tickets;
DROP POLICY IF EXISTS "Customers can reopen their own closed tickets" ON tickets;
DROP POLICY IF EXISTS "Company technicians can view company tickets" ON tickets;
DROP POLICY IF EXISTS "Company technicians can update company tickets" ON tickets;
DROP POLICY IF EXISTS "Company admins can view company tickets" ON tickets;
DROP POLICY IF EXISTS "Company admins can update company tickets" ON tickets;
DROP POLICY IF EXISTS "Company admins can delete company tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can update all tickets" ON tickets;
DROP POLICY IF EXISTS "Master admins can delete all tickets" ON tickets;
DROP POLICY IF EXISTS "Master technicians can update all tickets" ON tickets;
DROP POLICY IF EXISTS "Developers can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Developers can update any ticket" ON tickets;
DROP POLICY IF EXISTS "Developers can delete any ticket" ON tickets;

-- ============================================
-- NOVAS POLICIES OTIMIZADAS (SEM JOIN)
-- ============================================

-- CUSTOMERS: Ver apenas próprios tickets
CREATE POLICY "Customers can view own tickets"
ON tickets FOR SELECT
USING (user_id = auth.uid());

-- CUSTOMERS: Criar tickets (company_id preenchido pelo trigger)
CREATE POLICY "Customers can create tickets"
ON tickets FOR INSERT
WITH CHECK (user_id = auth.uid());

-- CUSTOMERS: Reabrir tickets próprios
CREATE POLICY "Customers can reopen own tickets"
ON tickets FOR UPDATE
USING (
  user_id = auth.uid() 
  AND status IN ('closed', 'resolved')
)
WITH CHECK (
  user_id = auth.uid() 
  AND status = 'reopened'
);

-- TECHNICIANS: Ver tickets da própria empresa
CREATE POLICY "Technicians view company tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);

-- TECHNICIANS: Atualizar tickets da própria empresa
CREATE POLICY "Technicians update company tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);

-- ADMINS (não-master): Ver tickets da própria empresa
CREATE POLICY "Admins view company tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
);

-- ADMINS (não-master): Atualizar tickets da própria empresa
CREATE POLICY "Admins update company tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
);

-- ADMINS (não-master): Deletar tickets da própria empresa
CREATE POLICY "Admins delete company tickets"
ON tickets FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_master_company_user(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
);

-- MASTER ADMINS: Ver todos os tickets
CREATE POLICY "Master admins view all tickets"
ON tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_master_company_user(auth.uid())
);

-- MASTER ADMINS: Atualizar todos os tickets
CREATE POLICY "Master admins update all tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_master_company_user(auth.uid())
);

-- MASTER ADMINS: Deletar todos os tickets
CREATE POLICY "Master admins delete all tickets"
ON tickets FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_master_company_user(auth.uid())
);

-- MASTER TECHNICIANS: Atualizar todos os tickets
CREATE POLICY "Master technicians update all tickets"
ON tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND is_master_company_user(auth.uid())
);

-- DEVELOPERS: Acesso total
CREATE POLICY "Developers view all tickets"
ON tickets FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers update all tickets"
ON tickets FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers delete all tickets"
ON tickets FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- ============================================
-- COMENTÁRIOS FINAIS
-- ============================================
COMMENT ON COLUMN tickets.company_id IS 'Desnormalização para performance: evita JOINs em RLS policies';
COMMENT ON TRIGGER trigger_set_ticket_company ON tickets IS 'Auto-preenche company_id do usuário na criação (segurança anti-injeção)';
COMMENT ON INDEX idx_tickets_company_id IS 'Índice de performance para filtros por empresa';
COMMENT ON INDEX idx_tickets_company_status IS 'Índice composto para dashboard (empresa + status)';