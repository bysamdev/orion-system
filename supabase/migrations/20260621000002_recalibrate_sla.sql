-- Recalibrate SLA thresholds based on remaining percentage and hours

CREATE OR REPLACE FUNCTION public.update_all_tickets_sla_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Atualizar status de SLA usando percentual restante
  UPDATE tickets
  SET sla_status = CASE
    WHEN NOW() > sla_due_date THEN 'breached'
    WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 10 
         OR EXTRACT(EPOCH FROM (sla_due_date - NOW())) <= 7200 THEN 'attention'
    WHEN (EXTRACT(EPOCH FROM (sla_due_date - NOW())) / EXTRACT(EPOCH FROM (sla_due_date - created_at))) * 100 <= 25 THEN 'warning'
    ELSE 'ok'
  END
  WHERE status NOT IN ('resolved', 'closed', 'cancelled', 'awaiting-customer', 'awaiting-third-party')
    AND sla_due_date IS NOT NULL
    AND sla_due_date > created_at;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
