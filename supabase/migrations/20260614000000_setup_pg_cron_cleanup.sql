-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function for audit_log
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
  WHERE read = true AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule the cleanup function to run every day at 3:00 AM
SELECT cron.schedule(
  'cleanup-old-logs-daily',
  '0 3 * * *',
  $$SELECT cleanup_audit_logs()$$
);
