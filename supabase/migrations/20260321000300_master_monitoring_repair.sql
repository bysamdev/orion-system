-- ============================================================
-- SCRIPT DE REPARO MESTRE: Monitoramento Orion
-- Descrição: Este script garante que TODAS as colunas necessárias para
--            o Agente V2 e para o Multi-Tenancy existam no banco.
-- ============================================================

-- 1. Reparar tabela 'machine_groups'
ALTER TABLE public.machine_groups 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS client_contact TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Reparar tabela 'machines'
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS os TEXT,
ADD COLUMN IF NOT EXISTS os_version TEXT,
ADD COLUMN IF NOT EXISTS agent_version TEXT,
ADD COLUMN IF NOT EXISTS machine_token TEXT,
ADD COLUMN IF NOT EXISTS machine_uuid UUID,
ADD COLUMN IF NOT EXISTS "current_user" TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- REMOVER restrição de hostname unico (causa erro se duas máquinas tiverem o mesmo nome)
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_hostname_key;
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_hostname_unique;

-- Garantir que machine_token seja único para o Upsert funcionar
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_machine_token_key') THEN
        ALTER TABLE public.machines ADD CONSTRAINT machines_machine_token_key UNIQUE (machine_token);
    END IF;
END $$;

-- 3. Reparar tabela 'machine_hardware'
ALTER TABLE public.machine_hardware
ADD COLUMN IF NOT EXISTS interfaces JSONB;

-- Garantir que cada máquina tenha somente um registro de hardware para o Upsert funcionar
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machine_hardware_machine_id_key') THEN
        ALTER TABLE public.machine_hardware ADD CONSTRAINT machine_hardware_machine_id_key UNIQUE (machine_id);
    END IF;
END $$;

-- 4. Garantir tabela 'machine_commands' (para o Polling de comandos)
CREATE TABLE IF NOT EXISTS public.machine_commands (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  command      TEXT          NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pending', -- pending, sent, completed, failed
  output       TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_machine_groups_company_id ON public.machine_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON public.machines(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_machine_token ON public.machines(machine_token);

-- 5. Garantir RLS (Row Level Security) e Políticas Globais
ALTER TABLE public.machine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_commands ENABLE ROW LEVEL SECURITY;

-- Políticas para MACHINES
DROP POLICY IF EXISTS "Global select for machines" ON public.machines;
CREATE POLICY "Global select for machines" ON public.machines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Global insert for machines" ON public.machines;
CREATE POLICY "Global insert for machines" ON public.machines FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Global update for machines" ON public.machines;
CREATE POLICY "Global update for machines" ON public.machines FOR UPDATE TO authenticated USING (true);

-- Políticas para GROUPS (Importante para aparecer no painel!)
DROP POLICY IF EXISTS "Global select for groups" ON public.machine_groups;
CREATE POLICY "Global select for groups" ON public.machine_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Global insert for groups" ON public.machine_groups;
CREATE POLICY "Global insert for groups" ON public.machine_groups FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para COMMANDS
DROP POLICY IF EXISTS "Global select for commands" ON public.machine_commands;
CREATE POLICY "Global select for commands" ON public.machine_commands FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Global manage for commands" ON public.machine_commands;
CREATE POLICY "Global manage for commands" ON public.machine_commands FOR ALL TO authenticated USING (true);
