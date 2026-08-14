-- Migration: Add has_contract flag to companies (Client/Empresa contract status)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS has_contract BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.companies.has_contract IS 'Indica se a empresa/cliente possui contrato ativo (true) ou é atendimento esporádico/sem contrato (false)';

-- Sincronizar todas as empresas existentes para has_contract = true por padrão
UPDATE public.companies SET has_contract = true WHERE has_contract IS NULL;
