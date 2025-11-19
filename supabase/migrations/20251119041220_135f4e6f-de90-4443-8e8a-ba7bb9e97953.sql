-- Corrigir constraint ticket_updates_type_valid para permitir todos os tipos necessários
-- Remove constraint antigo se existir
ALTER TABLE ticket_updates 
DROP CONSTRAINT IF EXISTS ticket_updates_type_valid;

-- Adiciona constraint atualizado com todos os tipos válidos
ALTER TABLE ticket_updates 
ADD CONSTRAINT ticket_updates_type_valid 
CHECK (type IN ('comment', 'status_change', 'assignment', 'priority_change'));

-- Garantir que o default é 'comment' para novos registros
ALTER TABLE ticket_updates 
ALTER COLUMN type SET DEFAULT 'comment';