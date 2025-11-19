-- ============================================
-- BLOCO 2: SISTEMA SLA COMPLETO (Backend)
-- Implementação estilo GLPI/ITIL
-- ============================================

-- 1. ADICIONAR CAMPOS SLA NA TABELA TICKETS
ALTER TABLE tickets
ADD COLUMN sla_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN first_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sla_status TEXT DEFAULT 'ok' CHECK (sla_status IN ('ok', 'attention', 'breached'));

-- Criar índices para performance em queries de SLA
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due_date ON tickets(sla_due_date);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON tickets(sla_status);
CREATE INDEX IF NOT EXISTS idx_tickets_first_response_at ON tickets(first_response_at);

-- Adicionar comentários explicativos
COMMENT ON COLUMN tickets.sla_due_date IS 'Prazo final calculado automaticamente baseado na prioridade';
COMMENT ON COLUMN tickets.first_response_at IS 'Data da primeira interação de um técnico';
COMMENT ON COLUMN tickets.resolved_at IS 'Data/hora quando ticket foi marcado como resolvido';
COMMENT ON COLUMN tickets.sla_status IS 'Status do SLA: ok (verde), attention (amarelo), breached (vermelho)';

-- ============================================
-- 2. FUNÇÃO: CALCULAR SLA_DUE_DATE BASEADO NA PRIORIDADE
-- ============================================
CREATE OR REPLACE FUNCTION calculate_sla_due_date(ticket_priority TEXT, ticket_created_at TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sla_hours INTEGER;
BEGIN
  -- Mapear prioridade para horas de SLA
  CASE ticket_priority
    WHEN 'urgent' THEN sla_hours := 4;   -- Urgente: 4 horas
    WHEN 'high' THEN sla_hours := 24;    -- Alta: 24 horas
    WHEN 'medium' THEN sla_hours := 48;  -- Média: 48 horas
    WHEN 'low' THEN sla_hours := 72;     -- Baixa: 72 horas
    ELSE sla_hours := 48; -- Default: 48 horas
  END CASE;

  -- Retornar data de criação + horas do SLA
  RETURN ticket_created_at + (sla_hours || ' hours')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION calculate_sla_due_date IS 'Calcula prazo SLA baseado na prioridade: urgent=4h, high=24h, medium=48h, low=72h';

-- ============================================
-- 3. TRIGGER: DEFINIR SLA_DUE_DATE NA CRIAÇÃO DO TICKET
-- ============================================
CREATE OR REPLACE FUNCTION set_ticket_sla_on_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calcular sla_due_date automaticamente
  NEW.sla_due_date := calculate_sla_due_date(NEW.priority, NEW.created_at);
  
  -- Inicializar sla_status como 'ok'
  NEW.sla_status := 'ok';
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_set_sla_on_ticket_creation ON tickets;
CREATE TRIGGER trigger_set_sla_on_ticket_creation
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_sla_on_creation();

-- ============================================
-- 4. TRIGGER: ATUALIZAR SLA QUANDO PRIORIDADE MUDAR
-- ============================================
CREATE OR REPLACE FUNCTION update_sla_on_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a prioridade mudou, recalcular sla_due_date
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    NEW.sla_due_date := calculate_sla_due_date(NEW.priority, OLD.created_at);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_update_sla_on_priority_change ON tickets;
CREATE TRIGGER trigger_update_sla_on_priority_change
BEFORE UPDATE ON tickets
FOR EACH ROW
WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
EXECUTE FUNCTION update_sla_on_priority_change();

-- ============================================
-- 5. TRIGGER: REGISTRAR FIRST_RESPONSE_AT E RESOLVED_AT
-- ============================================
CREATE OR REPLACE FUNCTION track_ticket_response_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar first_response_at quando ticket passa para 'in-progress'
  IF OLD.status IN ('open', 'reopened') AND NEW.status = 'in-progress' THEN
    IF OLD.first_response_at IS NULL THEN
      NEW.first_response_at := NOW();
    END IF;
  END IF;
  
  -- Registrar resolved_at quando ticket é resolvido
  IF OLD.status NOT IN ('resolved', 'closed') AND NEW.status IN ('resolved', 'closed') THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- Limpar resolved_at se ticket for reaberto
  IF OLD.status IN ('resolved', 'closed') AND NEW.status = 'reopened' THEN
    NEW.resolved_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_track_response_times ON tickets;
CREATE TRIGGER trigger_track_response_times
BEFORE UPDATE ON tickets
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION track_ticket_response_times();

-- ============================================
-- 6. TRIGGER: REGISTRAR FIRST_RESPONSE_AT NO PRIMEIRO COMENTÁRIO DE TÉCNICO
-- ============================================
CREATE OR REPLACE FUNCTION track_first_tech_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value TEXT;
  ticket_first_response TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar se é um comentário (type = 'comment')
  IF NEW.type = 'comment' THEN
    -- Buscar role do autor
    SELECT role INTO user_role_value
    FROM user_roles
    WHERE user_id = NEW.author_id
    LIMIT 1;
    
    -- Se é técnico/admin/developer
    IF user_role_value IN ('technician', 'admin', 'developer') THEN
      -- Buscar first_response_at do ticket
      SELECT first_response_at INTO ticket_first_response
      FROM tickets
      WHERE id = NEW.ticket_id;
      
      -- Se ainda não foi registrada a primeira resposta, registrar agora
      IF ticket_first_response IS NULL THEN
        UPDATE tickets
        SET first_response_at = NOW()
        WHERE id = NEW.ticket_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger AFTER INSERT em ticket_updates
DROP TRIGGER IF EXISTS trigger_track_first_tech_comment ON ticket_updates;
CREATE TRIGGER trigger_track_first_tech_comment
AFTER INSERT ON ticket_updates
FOR EACH ROW
EXECUTE FUNCTION track_first_tech_comment();

-- ============================================
-- 7. FUNÇÃO: ATUALIZAR SLA_STATUS (Para ser chamada periodicamente)
-- ============================================
CREATE OR REPLACE FUNCTION update_all_tickets_sla_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Atualizar status de SLA para todos os tickets não resolvidos
  UPDATE tickets
  SET sla_status = CASE
    -- Breached: passou do prazo
    WHEN NOW() > sla_due_date THEN 'breached'
    -- Attention: menos de 4 horas restantes
    WHEN NOW() > (sla_due_date - INTERVAL '4 hours') THEN 'attention'
    -- Ok: mais de 4 horas restantes
    ELSE 'ok'
  END
  WHERE status NOT IN ('resolved', 'closed')
    AND sla_due_date IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION update_all_tickets_sla_status IS 'Atualiza sla_status de todos os tickets abertos. Deve ser chamada periodicamente (cron/scheduler)';

-- ============================================
-- 8. ATUALIZAR TICKETS EXISTENTES (MIGRAÇÃO DE DADOS)
-- ============================================

-- Calcular sla_due_date para tickets existentes
UPDATE tickets
SET sla_due_date = calculate_sla_due_date(priority, created_at)
WHERE sla_due_date IS NULL;

-- Preencher first_response_at baseado em mudanças de status históricas
-- (Se já está in-progress/resolved/closed, considerar que teve resposta)
UPDATE tickets
SET first_response_at = created_at + INTERVAL '1 hour'
WHERE status IN ('in-progress', 'resolved', 'closed')
  AND first_response_at IS NULL;

-- Preencher resolved_at para tickets já resolvidos/fechados
UPDATE tickets
SET resolved_at = updated_at
WHERE status IN ('resolved', 'closed')
  AND resolved_at IS NULL;

-- Atualizar sla_status inicial de todos os tickets
SELECT update_all_tickets_sla_status();

-- ============================================
-- FIM DO BLOCO 2 - BACKEND
-- ============================================