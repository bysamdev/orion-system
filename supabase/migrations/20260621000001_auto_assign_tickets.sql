-- Migração para auto-atribuição de tickets com round-robin

CREATE OR REPLACE FUNCTION public.fn_auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    agent_count INTEGER;
BEGIN
    -- Se o ticket já tem um responsável, não faz nada
    IF NEW.assigned_to_user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Conta quantos agentes ativos (technician, gestor, admin) existem na empresa
    SELECT COUNT(DISTINCT p.id) INTO agent_count
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.company_id = NEW.company_id
      AND ur.role IN ('technician', 'admin');

    IF agent_count = 1 THEN
        -- Apenas 1 agente, atribui diretamente
        SELECT p.id, p.full_name INTO NEW.assigned_to_user_id, NEW.assigned_to
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE p.company_id = NEW.company_id
          AND ur.role IN ('technician', 'admin')
        LIMIT 1;

    ELSIF agent_count > 1 THEN
        -- Múltiplos agentes, usa round-robin (menos tickets abertos)
        SELECT p.id, p.full_name INTO NEW.assigned_to_user_id, NEW.assigned_to
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        LEFT JOIN public.tickets t ON t.assigned_to_user_id = p.id AND t.status IN ('open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'reopened')
        WHERE p.company_id = NEW.company_id
          AND ur.role IN ('technician', 'admin')
        GROUP BY p.id, p.full_name
        ORDER BY COUNT(t.id) ASC, p.id ASC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_assign_ticket_fallback ON public.tickets;
CREATE TRIGGER tr_auto_assign_ticket_fallback
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_assign_ticket();

-- Cria a RPC function para obter o count pro frontend
CREATE OR REPLACE FUNCTION count_company_active_agents(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_agents INTEGER;
BEGIN
    SELECT COUNT(DISTINCT p.id) INTO total_agents
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.company_id = p_company_id
      AND ur.role IN ('technician', 'admin');
      
    RETURN total_agents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
