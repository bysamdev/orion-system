-- =============================================================================
-- Migration: 20260904100400_fix_ch_c10_reconcile_ticket_status_constraint.sql
--
-- Fix CH-C10: reconcile the ticket status constraint with production
--
-- ATENÇÃO — ESTA MIGRATION EXISTE POR CAUSA DE DRIFT DE SCHEMA.
--
--   O banco de produção foi editado fora do histórico de migrations. O
--   histórico deste repositório e o estado real divergiram, e é o histórico
--   que está errado.
--
--   Estado REAL em produção (lido de pg_constraint, projeto Orion System):
--     tickets_status_valid CHECK (status = ANY (ARRAY[
--       'open','in-progress','awaiting-customer','awaiting-third-party',
--       'resolved','closed','reopened','cancelled']))
--     tickets_status_check  -> NÃO EXISTE
--
--   Estado que este repositório produz ao ser reaplicado do zero:
--     tickets_status_valid CHECK (status IN ('open','in-progress','resolved','closed'))
--       vindo de 20251022050124_5bf970fe-5dc5-4408-8eb8-85fc5237b7ad.sql:7
--     tickets_status_check CHECK (status IN (os 8 valores))
--       vindo de 20260320000000_fix_ticket_status_enum.sql:9
--
--   A migration de 2026-03-20 dropou apenas tickets_status_check antes de
--   recriá-la, então tickets_status_valid, com só 4 valores, sobreviveu. O
--   Postgres aplica AND entre todas as CHECK da mesma coluna, logo o conjunto
--   efetivo de um banco reconstruído a partir do repositório é a INTERSEÇÃO:
--     ('open','in-progress','resolved','closed')
--
--   Ou seja: qualquer ambiente novo — staging, DR, máquina de dev, rebuild —
--   nasce rejeitando 'awaiting-customer', 'awaiting-third-party', 'reopened' e
--   'cancelled'. Isso quebra pausa de SLA, reabertura e cancelamento, embora
--   produção funcione normalmente. O sintoma nunca aparece em produção, só nos
--   ambientes derivados, o que torna o defeito especialmente traiçoeiro.
--
-- O QUE ESTA MIGRATION FAZ:
--   Converge os dois mundos para o estado de produção: uma única constraint
--   chamada tickets_status_valid, com os 8 valores. Em produção o efeito
--   prático é nulo (a constraint é recriada com a mesma definição); em
--   ambientes reconstruídos, é a correção.
--
-- CUSTO EM PRODUÇÃO:
--   O ADD CONSTRAINT revalida a tabela inteira. Em public.tickets isso é
--   barato, mas é um ACCESS EXCLUSIVE lock momentâneo — aplicar fora do pico.
--
-- NÃO ALTERA DADOS. Nenhuma linha é lida ou escrita além da validação da
-- constraint.
-- =============================================================================

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_valid;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_valid
  CHECK (status IN (
    'open',
    'in-progress',
    'awaiting-customer',
    'awaiting-third-party',
    'resolved',
    'closed',
    'reopened',
    'cancelled'
  ));

COMMENT ON CONSTRAINT tickets_status_valid ON public.tickets IS
  'Status válidos: open, in-progress, awaiting-customer, awaiting-third-party, '
  'resolved, closed, reopened, cancelled. Constraint única — ver CH-C10: '
  'tickets_status_check foi removida para eliminar a interseção com a versão '
  'de 4 valores que só existia no histórico de migrations.';

-- Verificação pós-aplicação (deve devolver UMA linha de status, com 8 valores):
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.tickets'::regclass AND contype = 'c'
--   ORDER BY conname;
--
-- Nota: public.validate_ticket_fields() valida a mesma lista de 8 status em
-- PL/pgSQL, no trigger trg_validate_ticket_fields. As duas listas precisam ser
-- alteradas juntas em qualquer mudança futura do ciclo de vida.
