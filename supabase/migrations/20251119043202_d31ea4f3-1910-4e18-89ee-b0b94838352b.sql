-- ============================================
-- CORREÇÃO DE SEGURANÇA: Function Search Path para funções SLA
-- ============================================

-- Corrigir funções SLA que não têm search_path definido

-- 1. set_ticket_sla_on_creation
CREATE OR REPLACE FUNCTION public.set_ticket_sla_on_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calcular sla_due_date automaticamente
  NEW.sla_due_date := calculate_sla_due_date(NEW.priority, NEW.created_at);
  
  -- Inicializar sla_status como 'ok'
  NEW.sla_status := 'ok';
  
  RETURN NEW;
END;
$$;

-- 2. update_sla_on_priority_change
CREATE OR REPLACE FUNCTION public.update_sla_on_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a prioridade mudou, recalcular sla_due_date
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    NEW.sla_due_date := calculate_sla_due_date(NEW.priority, OLD.created_at);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. track_ticket_response_times
CREATE OR REPLACE FUNCTION public.track_ticket_response_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar first_response_at quando ticket passa para 'in-progress'
  IF OLD.status IN ('open', 'reopened') AND NEW.status = 'in-progress' THEN
    IF OLD.first_response_at IS NULL THEN
      NEW.first_response_at := NOW();
    END IF;
  END IF;
  
  -- Registrar resolved_at quando ticket é resolvido
  IF OLD.status NOT IN ('resolved', 'closed') AND NEW.status IN ('resolved', 'closed') THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- Limpar resolved_at se ticket for reaberto
  IF OLD.status IN ('resolved', 'closed') AND NEW.status = 'reopened' THEN
    NEW.resolved_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. track_first_tech_comment
CREATE OR REPLACE FUNCTION public.track_first_tech_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value TEXT;
  ticket_first_response TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar se é um comentário (type = 'comment')
  IF NEW.type = 'comment' THEN
    -- Buscar role do autor
    SELECT role INTO user_role_value
    FROM user_roles
    WHERE user_id = NEW.author_id
    LIMIT 1;
    
    -- Se é técnico/admin/developer
    IF user_role_value IN ('technician', 'admin', 'developer') THEN
      -- Buscar first_response_at do ticket
      SELECT first_response_at INTO ticket_first_response
      FROM tickets
      WHERE id = NEW.ticket_id;
      
      -- Se ainda não foi registrada a primeira resposta, registrar agora
      IF ticket_first_response IS NULL THEN
        UPDATE tickets
        SET first_response_at = NOW()
        WHERE id = NEW.ticket_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_ticket_sla_on_creation() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.update_sla_on_priority_change() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.track_ticket_response_times() IS 'Segurança: search_path fixado para prevenir injection';
COMMENT ON FUNCTION public.track_first_tech_comment() IS 'Segurança: search_path fixado para prevenir injection';