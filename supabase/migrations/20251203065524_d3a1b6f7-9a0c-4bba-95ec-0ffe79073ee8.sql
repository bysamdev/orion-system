-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Índices B-Tree para colunas mais filtradas
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON tickets(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON tickets(sla_status) WHERE sla_status IN ('attention', 'breached');

-- Índice composto para queries comuns (status + company)
CREATE INDEX IF NOT EXISTS idx_tickets_company_status ON tickets(company_id, status);

-- Índice GIN para busca full-text
CREATE INDEX IF NOT EXISTS idx_tickets_search_vector ON tickets USING GIN(search_vector);

-- Função para auto-fechar chamados resolvidos há mais de 48h
CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  UPDATE tickets
  SET status = 'closed', updated_at = now()
  WHERE status = 'resolved'
    AND resolved_at < now() - INTERVAL '48 hours';
  
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

-- Trigger para atualizar search_vector automaticamente
CREATE OR REPLACE FUNCTION public.update_ticket_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.requester_name, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_search_vector ON tickets;
CREATE TRIGGER trigger_update_search_vector
  BEFORE INSERT OR UPDATE OF title, description, requester_name, category
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_search_vector();