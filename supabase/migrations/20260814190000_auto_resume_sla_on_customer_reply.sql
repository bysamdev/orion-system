-- Migration: Auto Pause/Resume SLA and Auto-Resume Ticket on Customer Reply
-- 1. Function and Trigger to pause/resume SLA on status change and push due date
CREATE OR REPLACE FUNCTION public.tr_ticket_sla_pause()
RETURNS TRIGGER AS $$
DECLARE
    v_pause_interval INTERVAL;
BEGIN
    -- Se o status mudar para status de pausa (awaiting-customer ou awaiting-third-party), registra o início da pausa
    IF (NEW.status IN ('awaiting-customer', 'awaiting-third-party')) 
       AND (OLD.id IS NULL OR OLD.status NOT IN ('awaiting-customer', 'awaiting-third-party')) THEN
        NEW.sla_paused_at := now();
    END IF;

    -- Se o status sair de um estado de pausa para um estado ativo, retoma o SLA e empurra o vencimento
    IF (OLD.status IN ('awaiting-customer', 'awaiting-third-party')) 
       AND (NEW.status NOT IN ('awaiting-customer', 'awaiting-third-party')) THEN
        
        IF OLD.sla_paused_at IS NOT NULL THEN
            -- Calcula o intervalo exato em que o chamado ficou pausado
            v_pause_interval := now() - OLD.sla_paused_at;
            
            -- Acumula minutos totais pausados
            NEW.sla_accumulated_pause_minutes := COALESCE(OLD.sla_accumulated_pause_minutes, 0) + 
                ROUND(EXTRACT(EPOCH FROM v_pause_interval) / 60);
            
            -- EMPURRA a data de vencimento do SLA pelo tempo que ficou pausado
            IF NEW.sla_due_date IS NOT NULL THEN
                NEW.sla_due_date := OLD.sla_due_date + v_pause_interval;
            END IF;
            
            -- Limpa o timestamp de pausa
            NEW.sla_paused_at := NULL;

            -- Recalcula status do SLA baseado na nova data estendida
            IF NEW.sla_due_date IS NOT NULL THEN
                IF now() > NEW.sla_due_date THEN
                    NEW.sla_status := 'breached';
                ELSIF now() > (NEW.sla_due_date - INTERVAL '4 hours') THEN
                    NEW.sla_status := 'attention';
                ELSE
                    NEW.sla_status := 'ok';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_ticket_sla_pause_trigger ON public.tickets;
CREATE TRIGGER tr_ticket_sla_pause_trigger
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_ticket_sla_pause();

-- 2. Function and Trigger to automatically resume ticket and SLA when customer replies
CREATE OR REPLACE FUNCTION public.tr_auto_resume_on_customer_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_user_id UUID;
    v_ticket_status TEXT;
    v_assigned_to_user_id UUID;
    v_is_customer BOOLEAN := FALSE;
    v_new_status TEXT;
BEGIN
    -- Ignora notas internas técnicas privadas
    IF NEW.is_internal = TRUE THEN
        RETURN NEW;
    END IF;

    -- Ignora atualizações automáticas geradas pelo próprio sistema
    IF NEW.type IN ('status_change', 'assignment', 'priority_change') THEN
        RETURN NEW;
    END IF;

    -- Busca informações do chamado
    SELECT user_id, status, assigned_to_user_id 
    INTO v_ticket_user_id, v_ticket_status, v_assigned_to_user_id 
    FROM public.tickets 
    WHERE id = NEW.ticket_id;

    -- Se o chamado não existir ou não estiver em status de pausa/espera, não faz nada
    IF v_ticket_status NOT IN ('awaiting-customer', 'awaiting-third-party') THEN
        RETURN NEW;
    END IF;

    -- Verifica se o autor da mensagem é o próprio solicitante do chamado
    IF NEW.author_id = v_ticket_user_id THEN
        v_is_customer := TRUE;
    ELSE
        -- Ou se o autor possui a role 'customer'
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.author_id AND role = 'customer'
        ) INTO v_is_customer;
    END IF;

    -- Se quem respondeu foi o cliente/solicitante, retoma o chamado automaticamente!
    IF v_is_customer THEN
        -- Se já possui técnico atribuído, volta para 'in-progress' (Em Atendimento)
        -- Caso contrário, volta para 'open' (Aberto)
        IF v_assigned_to_user_id IS NOT NULL THEN
            v_new_status := 'in-progress';
        ELSE
            v_new_status := 'open';
        END IF;

        -- Atualiza o ticket para o novo status (o trigger tr_ticket_sla_pause despausará o SLA automaticamente)
        UPDATE public.tickets
        SET 
            status = v_new_status,
            updated_at = now()
        WHERE id = NEW.ticket_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_auto_resume_on_customer_reply_trigger ON public.ticket_updates;
CREATE TRIGGER tr_auto_resume_on_customer_reply_trigger
AFTER INSERT ON public.ticket_updates
FOR EACH ROW
EXECUTE FUNCTION public.tr_auto_resume_on_customer_reply();
