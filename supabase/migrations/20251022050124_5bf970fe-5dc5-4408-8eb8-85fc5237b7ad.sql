
-- Remover constraint antigo
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_valid;

-- Adicionar novo constraint com valores corretos (aceita hífen)
ALTER TABLE tickets ADD CONSTRAINT tickets_status_valid 
CHECK (status IN ('open', 'in-progress', 'resolved', 'closed'));
