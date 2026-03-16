-- ============================================================
-- SCRIPT DE REPARO MESTRE: Monitoramento Orion
-- Descrição: Este script garante que TODAS as colunas necessárias para
--            o Agente V2 e para o Multi-Tenancy existam no banco.
-- ============================================================

-- 1. Reparar tabela 'machine_groups'
ALTER TABLE public.machine_groups 
ADD COLUMN IF NOT EXISTS description TEXT,
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

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_machine_groups_company_id ON public.machine_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON public.machines(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_machine_token ON public.machines(machine_token);

-- 5. Garantir RLS (Row Level Security)
ALTER TABLE public.machine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Política de visualização global para administradores (ajuste conforme necessário)
DROP POLICY IF EXISTS "Global select for machines" ON public.machines;
CREATE POLICY "Global select for machines" ON public.machines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Global insert for machines" ON public.machines;
CREATE POLICY "Global insert for machines" ON public.machines FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Global update for machines" ON public.machines;
CREATE POLICY "Global update for machines" ON public.machines FOR UPDATE TO authenticated USING (true);
