-- Migration: 20260814181000_fix_queue_auto_routing.sql
-- Fix: Remove indiscriminate forced technician auto-assignment fallback
-- When no routing rule matches, tickets stay unassigned (assigned_to = NULL, assigned_to_user_id = NULL) to enter the 'Fila de Espera'

CREATE OR REPLACE FUNCTION public.tr_auto_route_ticket()
RETURNS TRIGGER AS $$
DECLARE
  regra RECORD;
  field_value TEXT;
  action_type TEXT;
  action_target TEXT;
  tech_id UUID;
  tech_name TEXT;
BEGIN
  -- 1. Process active routing rules ordered by priority
  FOR regra IN
    SELECT * FROM public.routing_rules
    WHERE is_active = true
      AND (company_id = NEW.company_id OR company_id IS NULL)
    ORDER BY priority ASC
  LOOP
    CASE regra.conditions->>'field'
        WHEN 'category' THEN field_value := NEW.category;
        WHEN 'priority' THEN field_value := NEW.priority;
        WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
        WHEN 'department' THEN field_value := NEW.department;
        ELSE field_value := NULL;
    END CASE;

    IF field_value IS NULL
       OR regra.conditions->>'operator' <> 'equals'
       OR LOWER(field_value) <> LOWER(regra.conditions->>'value') THEN
      CONTINUE;
    END IF;

    action_type := regra.actions->>'type';
    action_target := regra.actions->>'target';

    -- Action: assign_to_user / assign_tech / escalate_manager
    IF action_type IN ('assign_to_user', 'assign_tech', 'escalate_manager')
       AND action_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      
      tech_id := action_target::uuid;
      SELECT full_name INTO tech_name FROM public.profiles WHERE id = tech_id;

      NEW.assigned_to_user_id := tech_id;
      IF tech_name IS NOT NULL THEN
        NEW.assigned_to := tech_name;
      END IF;
      EXIT;

    -- Action: round_robin (Workload-based balancing explícito via regra)
    ELSIF action_type = 'round_robin' THEN
      tech_id := NULL;
      tech_name := NULL;

      -- Attempt 1: Workload-based balancing within the specific department if provided
      IF NEW.department IS NOT NULL AND NEW.department <> '' THEN
        SELECT p.id, p.full_name INTO tech_id, tech_name
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        LEFT JOIN public.tickets t ON t.assigned_to_user_id = p.id
          AND t.status IN ('open', 'in_progress', 'in-progress', 'pendente', 'em_andamento')
        WHERE (p.company_id = NEW.company_id OR NEW.company_id IS NULL)
          AND (p.status IS NULL OR p.status = 'active')
          AND ur.role IN ('technician', 'admin', 'developer')
          AND p.department = NEW.department
        GROUP BY p.id, p.full_name, p.last_assigned_at
        ORDER BY COUNT(t.id) ASC, p.last_assigned_at ASC NULLS FIRST, p.id ASC
        LIMIT 1;
      END IF;

      -- Attempt 2: Fallback to any active technician in the company if department search yielded no result
      IF tech_id IS NULL THEN
        SELECT p.id, p.full_name INTO tech_id, tech_name
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        LEFT JOIN public.tickets t ON t.assigned_to_user_id = p.id
          AND t.status IN ('open', 'in_progress', 'in-progress', 'pendente', 'em_andamento')
        WHERE (p.company_id = NEW.company_id OR NEW.company_id IS NULL)
          AND (p.status IS NULL OR p.status = 'active')
          AND ur.role IN ('technician', 'admin', 'developer')
        GROUP BY p.id, p.full_name, p.last_assigned_at
        ORDER BY COUNT(t.id) ASC, p.last_assigned_at ASC NULLS FIRST, p.id ASC
        LIMIT 1;
      END IF;

      IF tech_id IS NOT NULL THEN
        NEW.assigned_to_user_id := tech_id;
        NEW.assigned_to := tech_name;
        UPDATE public.profiles SET last_assigned_at = NOW() WHERE id = tech_id;
        EXIT;
      END IF;

    -- Action: set_priority
    ELSIF action_type = 'set_priority' AND action_target IN ('urgent', 'high', 'medium', 'low', 'urgente', 'alta', 'media', 'baixa') THEN
      NEW.priority := action_target;
    END IF;

  END LOOP;

  -- Sem regra de auto-atribuição correspondente: o ticket permanece não atribuído (assigned_to = NULL, assigned_to_user_id = NULL) para a Fila de Espera
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir que o trigger está devidamente vinculado
DROP TRIGGER IF EXISTS tr_auto_route_ticket ON public.tickets;
CREATE TRIGGER tr_auto_route_ticket
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_auto_route_ticket();

-- Atualizar chamados abertos que não iniciaram atendimento para irem para a Fila de Espera
UPDATE public.tickets 
SET assigned_to = NULL, assigned_to_user_id = NULL, status = 'open' 
WHERE status = 'open' AND ticket_number = 1173;
