-- ORN-SEC-19: tickets.remote_password fica em texto no banco (decisão
-- antiga, para o técnico conectar) e era copiada inteira para audit_log a
-- cada INSERT/UPDATE/DELETE do chamado, onde ficava por 90 dias.
--
-- Decisão de 23/09/2026:
-- 1. a auditoria deixa de gravar o campo remote_password (em qualquer tabela
--    auditada; só tickets tem esse campo);
-- 2. ao resolver, fechar ou cancelar o chamado a senha é apagada: depois do
--    atendimento ninguém precisa mais dela.
--
-- As linhas antigas de audit_log que já contêm a senha não são alteradas
-- aqui (ver o card no Notion).

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

CREATE OR REPLACE FUNCTION public.apaga_senha_remota_ao_encerrar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed', 'cancelled') AND NEW.remote_password IS NOT NULL THEN
    NEW.remote_password := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apaga_senha_remota_ao_encerrar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apaga_senha_remota_ao_encerrar ON public.tickets;
CREATE TRIGGER trg_apaga_senha_remota_ao_encerrar
  BEFORE UPDATE OF status, remote_password ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apaga_senha_remota_ao_encerrar();

-- Chamados já encerrados que ainda tenham senha guardada.
UPDATE public.tickets
   SET remote_password = NULL
 WHERE status IN ('resolved', 'closed', 'cancelled')
   AND remote_password IS NOT NULL;
