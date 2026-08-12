-- Migration: 20260812200000_fix_auto_route_ticket_trigger_complete.sql
-- Fix Problem 2: Routing Trigger Bugs & Workload Round-Robin Balancing

CREATE OR REPLACE FUNCTION public.tr_auto_route_ticket()
RETURNS TRIGGER AS $$
DECLARE
  regra RECORD;
  matched BOOLEAN := false;
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
      matched := true;
      EXIT;

    -- Action: round_robin (Workload-based balancing)
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
        matched := true;
        EXIT;
      END IF;

    -- Action: set_priority
    ELSIF action_type = 'set_priority' AND action_target IN ('urgent', 'high', 'medium', 'low', 'urgente', 'alta', 'media', 'baixa') THEN
      NEW.priority := action_target;
    END IF;

  END LOOP;

  -- 2. Fallback auto-assignment if no routing rule assigned a technician and assigned_to_user_id is still NULL
  IF NOT matched AND NEW.assigned_to_user_id IS NULL THEN
    tech_id := NULL;
    tech_name := NULL;

    -- Attempt 1: Department workload balancing
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

    -- Attempt 2: Company-wide workload balancing
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger correctly to BEFORE INSERT ON public.tickets
DROP TRIGGER IF EXISTS tr_auto_route_ticket ON public.tickets;
CREATE TRIGGER tr_auto_route_ticket
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_auto_route_ticket();
