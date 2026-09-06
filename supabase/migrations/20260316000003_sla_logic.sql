-- SLA Pause Logic Triggers
CREATE OR REPLACE FUNCTION public.tr_ticket_sla_pause()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Se o status mudar para "awaiting-customer", pausa o SLA
    IF NEW.status = 'awaiting-customer' AND (OLD.id IS NULL OR OLD.status != 'awaiting-customer') THEN
        NEW.sla_paused_at := now();
    END IF;

    -- 2. Se o status sair de "awaiting-customer", retoma o SLA e acumula o tempo pausado
    IF OLD.status = 'awaiting-customer' AND NEW.status != 'awaiting-customer' THEN
        IF OLD.sla_paused_at IS NOT NULL THEN
            NEW.sla_accumulated_pause_minutes := COALESCE(OLD.sla_accumulated_pause_minutes, 0) + 
                EXTRACT(EPOCH FROM (now() - OLD.sla_paused_at)) / 60;
            NEW.sla_paused_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ticket_sla_pause_trigger
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_ticket_sla_pause();

-- Auto-resume SLA on customer reply
CREATE OR REPLACE FUNCTION public.tr_auto_resume_sla_on_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_status TEXT;
    v_author_role TEXT;
BEGIN
    -- Busca status atual do ticket
    SELECT status INTO v_ticket_status FROM public.tickets WHERE id = NEW.ticket_id;
    
    -- Busca role do autor
    SELECT role INTO v_author_role FROM public.profiles WHERE id = NEW.author_id;

    -- Se o ticket está aguardando cliente e o cliente responde, volta para 'open'
    IF v_ticket_status = 'awaiting-customer' AND v_author_role = 'customer' THEN
        UPDATE public.tickets 
        SET status = 'open' 
        WHERE id = NEW.ticket_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_auto_resume_sla_on_reply_trigger
AFTER INSERT ON public.ticket_updates
FOR EACH ROW
EXECUTE FUNCTION public.tr_auto_resume_sla_on_reply();
