-- Migration: Audit trail for remote terminal (PTY) sessions
-- Created: 2026-08-20
--
-- audit_log (existente) e' alimentada por audit_trigger_function em cima de
-- mudanca de linha (old_data/new_data de um UPDATE/DELETE/INSERT rastreado) —
-- nao serve pra "usuario X abriu terminal na maquina Y", que nao e' uma
-- mudanca de linha em nenhuma tabela rastreada. Tabela dedicada, mais simples
-- de consultar ("quem abriu terminal nesta maquina, quando") do que misturar
-- com o formato generico old_data/new_data.
--
-- Escrita feita pelo backend Go (handler/ws_terminal.go) via conexao direta
-- ao Postgres, nao via PostgREST/RLS — a policy de SELECT abaixo e' so pra
-- eventual leitura pelo front-end via Supabase client.

CREATE TABLE public.remote_terminal_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    company_id uuid,
    opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_remote_terminal_sessions_machine_id ON public.remote_terminal_sessions(machine_id);
CREATE INDEX idx_remote_terminal_sessions_company_id ON public.remote_terminal_sessions(company_id);
CREATE INDEX idx_remote_terminal_sessions_opened_at ON public.remote_terminal_sessions(opened_at DESC);

ALTER TABLE public.remote_terminal_sessions ENABLE ROW LEVEL SECURITY;

-- Mesmo criterio de acesso das demais tabelas de monitoramento: developer/
-- master enxergam tudo, admin so a propria empresa. Nunca technician/customer
-- — sessao de terminal e' trilha de auditoria de uma acao privilegiada.
CREATE POLICY "Admins and developers can view remote terminal session audit"
ON public.remote_terminal_sessions
FOR SELECT
TO authenticated
USING (
    has_role(auth.uid(), 'developer'::app_role)
    OR is_master_company_user(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
);

-- Sem policy de INSERT/UPDATE/DELETE para 'authenticated': a unica escrita
-- legitima e' o backend Go, que conecta com papel privilegiado e bypassa RLS.
