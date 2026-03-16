-- Trigger for SLA Escalations and Contract Alerts

-- Function to handle SLA Escalations
CREATE OR REPLACE FUNCTION public.fn_sla_escalation_monitor()
RETURNS TRIGGER AS $$
DECLARE
    rule_record RECORD;
    minutes_open INTEGER;
BEGIN
    -- Check if ticket is still open/in-progress and has a technician assigned
    IF NEW.status IN ('open', 'in-progress') AND NEW.assigned_to_user_id IS NOT NULL THEN
        -- Calculate minutes since creation or last update if needed
        -- For simplicity, let's use created_at
        minutes_open := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60;

        -- Check if it should escalate (e.g., > 30 mins without first response)
        IF NEW.first_response_at IS NULL AND minutes_open > 30 THEN
            -- Escalate priority or notify
            NEW.priority := 'urgent';
            -- Mark as escalated in a potential hidden field or just priority
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct contract tickets on closure
CREATE OR REPLACE FUNCTION public.fn_deduct_contract_ticket()
RETURNS TRIGGER AS $$
BEGIN
    -- Only when status changes to 'resolved' or 'closed'
    IF (NEW.status IN ('resolved', 'closed')) AND (OLD.status NOT IN ('resolved', 'closed')) THEN
        IF NEW.contract_id IS NOT NULL THEN
            UPDATE public.contracts 
            SET tickets_used = COALESCE(tickets_used, 0) + 1
            WHERE id = NEW.contract_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS tr_deduct_contract_ticket ON public.tickets;
CREATE TRIGGER tr_deduct_contract_ticket
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_deduct_contract_ticket();
