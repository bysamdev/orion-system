-- A coluna status existe em produção, mas não era criada pelo histórico
-- versionado antes das funções de notificação que a consultam. No replay
-- de um banco limpo, essa lacuna fazia a migration seguinte falhar (42703).
-- Em produção, onde a coluna já existe, esta migration não altera o schema.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
