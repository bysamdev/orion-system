-- =================================================================================
-- Migration: Secure Cleanup Audit Logs
-- Description: Sets search_path = public, pg_temp on cleanup_audit_logs
-- =================================================================================

CREATE OR REPLACE FUNCTION public.cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Remover registros de audit_log mais antigos que 90 dias
  DELETE FROM audit_log 
  WHERE changed_at < NOW() - INTERVAL '90 days';
  
  -- Remover registros de notifications lidos mais antigos que 30 dias
  DELETE FROM notifications
  WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
END;
$$;
