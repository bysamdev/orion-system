-- =================================================================================
-- Migration: 20260914140000_senha_de_acesso_remoto.sql
--
-- Reintroduz tickets.remote_password, desta vez em texto simples.
--
-- Histórico: a coluna existiu com criptografia por trigger e foi removida em
-- 20260910180000_drop_remote_password.sql porque ninguém conseguia ler o
-- valor de volta — nem o técnico que precisava dele para conectar. A
-- 20260914120000 registrou que não a reintroduziria; esta migration reverte
-- essa decisão por pedido explícito do produto (2026-09-14).
--
-- Por que texto simples: é a senha de sessão que o AnyDesk/TeamViewer mostra
-- na tela do cliente, de curta duração e só útil junto com remote_id — que
-- já é texto simples na mesma tabela. Visibilidade segue o RLS de tickets
-- (o próprio cliente e a equipe com acesso ao chamado). Nenhuma função de
-- criptografia, trigger ou chave é recriada.
-- =================================================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS remote_password text;

COMMENT ON COLUMN public.tickets.remote_password IS
  'Senha de sessão do acesso remoto informada pelo cliente, em texto simples. NULL = não informada.';
