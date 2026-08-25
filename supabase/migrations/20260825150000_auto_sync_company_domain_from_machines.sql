-- Migração: Sincronização automática do domínio da empresa a partir dos agentes/máquinas
CREATE OR REPLACE FUNCTION public.sync_company_domain_from_machine()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_company_domain ON public.machines;

CREATE TRIGGER trg_sync_company_domain
AFTER INSERT OR UPDATE OF domain, company_id ON public.machines
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_domain_from_machine();
