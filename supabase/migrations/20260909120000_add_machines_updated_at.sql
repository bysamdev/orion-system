-- Fix: RejectMachine (lib/monitoring.go) faz
--   UPDATE public.machines SET approval_status = 'rejected', status = 'offline', updated_at = now()
-- mas a tabela machines nunca teve coluna updated_at, gerando
-- "ERROR: column \"updated_at\" of relation \"machines\" does not exist (SQLSTATE 42703)"
-- ao clicar em "Rejeitar" no painel de máquinas pendentes. O código já assume/gerencia
-- esse campo explicitamente (não depende de trigger) — só falta a coluna.

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
