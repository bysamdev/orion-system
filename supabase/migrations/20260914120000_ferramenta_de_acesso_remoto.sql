-- =================================================================================
-- Migration: 20260914120000_ferramenta_de_acesso_remoto.sql
--
-- Item 4 do lote de 2026-09-12 (fase 4B): o chamado passa a registrar QUAL
-- ferramenta de acesso remoto o cliente informou.
--
-- Hoje existe só remote_id, e o campo no formulário se chamava
-- "ID (TeamViewer / AnyDesk)". O técnico recebia um número e tinha que
-- adivinhar em qual programa colar. ID de TeamViewer e endereço de AnyDesk
-- são ambos numéricos e de comprimento parecido, então não dá para deduzir
-- pelo formato.
--
-- ---------------------------------------------------------------------------
-- Por que nullable, e por que o CHECK deixa passar NULL
--
-- Os 8 chamados existentes ficam com remote_tool nulo — não há como saber
-- retroativamente qual ferramenta era, e chutar contaminaria o dado. A UI
-- trata nulo como "não informada".
--
-- `remote_tool IN ('teamviewer','anydesk')` avalia para NULL quando a coluna
-- é NULL, e CHECK só rejeita quando o resultado é FALSE. É isso que permite
-- a coluna nascer opcional sem uma segunda cláusula.
--
-- ---------------------------------------------------------------------------
-- O que esta migration deliberadamente NÃO faz
--
-- Não amarra remote_tool a remote_id por constraint. A obrigatoriedade ("se
-- informou o ID, escolha a ferramenta") vive no formulário: é regra de
-- produto, e o mesmo chamado pode ser aberto por técnico, por integração ou
-- por alerta crítico — caminhos que não passam pela tela e não devem quebrar.
-- Mesmo raciocínio da fase 3 para o bloqueio por avaliação.
--
-- Não reintroduz remote_password em nenhuma forma. A coluna foi removida em
-- 2026-09-10 e continua ausente; confirmado em information_schema antes desta
-- migration.
-- =================================================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS remote_tool text;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_remote_tool_valid;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_remote_tool_valid
  CHECK (remote_tool IN ('teamviewer', 'anydesk'));

COMMENT ON COLUMN public.tickets.remote_tool IS
  'Ferramenta de acesso remoto informada pelo cliente. NULL = não informada (inclui todos os chamados anteriores a 2026-09-14).';
