-- ============================================
-- CORREÇÃO: Expandir constraint ticket_updates_type_valid
-- ============================================

-- Remover constraint antiga
ALTER TABLE public.ticket_updates 
DROP CONSTRAINT IF EXISTS ticket_updates_type_valid;

-- Adicionar constraint expandida com todos os tipos possíveis do sistema
-- Tipos de usuário: comment, status_change, assignment, priority_change
-- Tipos de sistema: created, opened, closed, reopened, resolved
-- Tipos de SLA: sla_breached, sla_warning, sla_reset
-- Tipos de automação: auto_escalated, auto_assigned
ALTER TABLE public.ticket_updates 
ADD CONSTRAINT ticket_updates_type_valid 
CHECK (type IN (
  'comment',           -- Comentário de usuário
  'status_change',     -- Mudança de status
  'assignment',        -- Atribuição de técnico
  'priority_change',   -- Mudança de prioridade
  'created',           -- Ticket criado (log de sistema)
  'opened',            -- Ticket aberto
  'closed',            -- Ticket fechado
  'reopened',          -- Ticket reaberto
  'resolved',          -- Ticket resolvido
  'sla_breached',      -- SLA violado
  'sla_warning',       -- Aviso de SLA próximo
  'sla_reset',         -- SLA recalculado
  'auto_escalated',    -- Escalado automaticamente
  'auto_assigned'      -- Atribuído automaticamente
));

COMMENT ON CONSTRAINT ticket_updates_type_valid ON public.ticket_updates IS 
'Permite tipos de atualização de usuário, sistema, SLA e automação';
