-- =================================================================================
-- Migration: Fix Cron Jobs & History Triggers
-- Description: 
-- 1. Makes ticket_status_history.changed_by nullable so system/cron updates (which 
--    don't have an auth.uid()) can insert status changes without constraint errors.
-- 2. Fixes cleanup_audit_logs() referencing "read" instead of "is_read" column.
-- =================================================================================

-- 1. Fix ticket_status_history constraint
ALTER TABLE public.ticket_status_history 
ALTER COLUMN changed_by DROP NOT NULL;

-- 2. Fix cleanup_audit_logs function
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
