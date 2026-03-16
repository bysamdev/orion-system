-- Migration: Fix SLA Pause Logic and pushed due date
-- This migration updates the SLA logic to correctly push the due date forward when a ticket is resumed from a paused state.

-- 1. Redefine SLA Pause logic to include 'awaiting-third-party' and push 'sla_due_date'
CREATE OR REPLACE FUNCTION public.tr_ticket_sla_pause()
RETURNS TRIGGER AS $$
DECLARE
    v_pause_interval INTERVAL;
BEGIN
    -- Se o status mudar para status de pausa, registra o momento do início
    IF (NEW.status IN ('awaiting-customer', 'awaiting-third-party')) 
       AND (OLD.id IS NULL OR OLD.status NOT IN ('awaiting-customer', 'awaiting-third-party')) THEN
        NEW.sla_paused_at := now();
    END IF;

    -- Se o status sair de um estado de pausa, retoma e empurra o vencimento
    IF (OLD.status IN ('awaiting-customer', 'awaiting-third-party')) 
       AND (NEW.status NOT IN ('awaiting-customer', 'awaiting-third-party')) THEN
        
        IF OLD.sla_paused_at IS NOT NULL THEN
            -- Calcula o intervalo pausado
            v_pause_interval := now() - OLD.sla_paused_at;
            
            -- Acumula minutos para estatísticas
            NEW.sla_accumulated_pause_minutes := COALESCE(OLD.sla_accumulated_pause_minutes, 0) + 
                EXTRACT(EPOCH FROM v_pause_interval) / 60;
            
            -- EMPURRA o vencimento real do SLA
            IF NEW.sla_due_date IS NOT NULL THEN
                NEW.sla_due_date := OLD.sla_due_date + v_pause_interval;
            END IF;
            
            -- Limpa o timer de pausa
            NEW.sla_paused_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update the periodic status update function to ignore paused tickets
CREATE OR REPLACE FUNCTION public.update_all_tickets_sla_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Atualizar status de SLA para todos os tickets não resolvidos E não pausados
  UPDATE tickets
  SET sla_status = CASE
    WHEN NOW() > sla_due_date THEN 'breached'
    WHEN NOW() > (sla_due_date - INTERVAL '4 hours') THEN 'attention'
    ELSE 'ok'
  END
  WHERE status NOT IN ('resolved', 'closed', 'cancelled', 'awaiting-customer', 'awaiting-third-party')
    AND sla_due_date IS NOT NULL;
  
  -- Para os pausados, manter o status anterior ou garantir que não estão 'breached' injustamente
  -- (Opcional: podemos marcar como 'ok' enquanto pausado para visual limpo)
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
