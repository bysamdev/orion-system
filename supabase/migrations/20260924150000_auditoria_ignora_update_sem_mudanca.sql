-- Auditoria de espaço (docs/auditoria-espaco-supabase-2026-09-23.md): 96% das
-- alterações de chamados em audit_log (7.274 de 7.610, ~17 MB) só mudaram
-- updated_at. Vieram do sla-status-recalc, já corrigido em 19/09. Proteção
-- para o próximo caso: UPDATE em que nada muda além de updated_at não gera
-- linha de auditoria. Não há o que auditar nele.
--
-- Mantém o que 20260924020000 fez: remote_password fora do log.

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD) - 'remote_password', auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD) - 'remote_password', to_jsonb(NEW) - 'remote_password', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW) - 'remote_password', auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
