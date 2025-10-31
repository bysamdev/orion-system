-- Adicionar novo status "reopened" ao enum de status dos tickets
-- Primeiro, precisamos alterar o tipo enum para incluir o novo valor
ALTER TABLE tickets 
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets 
  ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('open', 'in-progress', 'resolved', 'closed', 'reopened'));

-- Comentário de documentação
COMMENT ON CONSTRAINT tickets_status_check ON tickets IS 
  'Status válidos: open (aberto), in-progress (em andamento), resolved (resolvido), closed (fechado), reopened (reaberto)';
