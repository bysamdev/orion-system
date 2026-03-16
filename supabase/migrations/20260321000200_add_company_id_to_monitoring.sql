-- Migration: Add company_id to monitoring tables
-- Description: Associa máquinas e grupos de máquinas a empresas específicas para garantir multi-tenancy.

-- 1. Adicionar company_id em machine_groups
ALTER TABLE public.machine_groups 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Adicionar company_id em machines
-- Nota: Embora a máquina pertença a um grupo, ter o company_id direto na máquina 
-- facilita consultas rápidas de métricas filtradas por empresa.
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_machine_groups_company_id ON public.machine_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON public.machines(company_id);

-- 4. Atualizar RLS Políticas para filtrar por empresa
-- Já existem políticas genéricas (USING true), vamos torná-las mais estritas no futuro se necessário.
-- Por enquanto, manteremos o acesso administrativo global conforme solicitado.
