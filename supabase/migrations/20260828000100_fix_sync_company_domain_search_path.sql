-- =================================================================================
-- Migration: 20260828000100_fix_sync_company_domain_search_path.sql
-- Descrição: sync_company_domain_from_machine() é SECURITY DEFINER sem
-- SET search_path -- única função nessa condição em todo o schema public
-- (confirmado pelo linter de segurança do Supabase). Sem search_path
-- fixo, um search_path malicioso na sessão do chamador pode fazer a
-- função resolver `public.companies` pra uma tabela de mesmo nome em
-- outro schema antes de public na busca. Só refixa o search_path -- lógica
-- da função e trigger inalteradas.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.sync_company_domain_from_machine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NEW.domain IS NOT NULL AND NEW.domain <> '' AND NEW.domain <> '.' AND NEW.domain <> 'local' THEN
    UPDATE public.companies
    SET domain = NEW.domain,
        updated_at = now()
    WHERE id = NEW.company_id
      AND (
        domain IS NULL
        OR domain = ''
        OR (domain = 'WORKGROUP' AND NEW.domain <> 'WORKGROUP')
      );
  END IF;
  RETURN NEW;
END;
$$;
