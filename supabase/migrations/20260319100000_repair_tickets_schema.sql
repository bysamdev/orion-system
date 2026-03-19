-- ============================================================
-- REPAIR MIGRATION: Tickets Schema & Automation Triggers
-- ============================================================

-- 1. Ensure all columns used in NewTicket.tsx exist in tickets table
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS remote_id TEXT,
  ADD COLUMN IF NOT EXISTS remote_password TEXT,
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id),
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id),
  ADD COLUMN IF NOT EXISTS machine_token TEXT,
  ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- 2. Fixed fn_auto_route_ticket (BEFORE INSERT)
-- Removed logging from here to prevent FK violations on NEW.id
CREATE OR REPLACE FUNCTION public.fn_auto_route_ticket()
RETURNS TRIGGER AS $$
DECLARE
  rule_rec       RECORD;
  is_match       BOOLEAN;
  field_value    TEXT;
  cond_field     TEXT;
  cond_op        TEXT;
  cond_val       TEXT;
  act_type       TEXT;
  act_target     TEXT;
  company_is_vip BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT is_vip INTO company_is_vip FROM public.companies WHERE id = NEW.company_id;

  FOR rule_rec IN
    SELECT * FROM public.routing_rules
    WHERE (company_id = NEW.company_id OR company_id IS NULL)
      AND is_active = true
    ORDER BY priority ASC
  LOOP
    is_match   := false;
    cond_field := rule_rec.conditions->>'field';
    cond_op    := rule_rec.conditions->>'operator';
    cond_val   := rule_rec.conditions->>'value';

    CASE cond_field
      WHEN 'category'   THEN field_value := NEW.category;
      WHEN 'priority'   THEN field_value := NEW.priority;
      WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
      WHEN 'title'      THEN field_value := NEW.title;
      WHEN 'is_vip'     THEN field_value := CASE WHEN company_is_vip THEN 'true' ELSE 'false' END;
      ELSE                   field_value := NULL;
    END CASE;

    IF field_value IS NOT NULL AND cond_op IS NOT NULL AND cond_val IS NOT NULL THEN
      IF cond_op = 'equals' THEN
        is_match := (LOWER(field_value) = LOWER(cond_val));
      ELSIF cond_op = 'contains' THEN
        is_match := (field_value ILIKE '%' || cond_val || '%');
      ELSIF cond_op = 'not_equals' THEN
        is_match := (LOWER(field_value) <> LOWER(cond_val));
      END IF;
    END IF;

    IF NOT is_match THEN CONTINUE; END IF;

    act_type   := rule_rec.actions->>'type';
    act_target := rule_rec.actions->>'target';

    IF (act_type = 'assign_tech' OR act_type = 'assign_to_user') AND act_target ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      NEW.assigned_to_user_id := act_target::UUID;
      SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id = NEW.assigned_to_user_id;

    ELSIF act_type = 'round_robin' THEN
      SELECT id, full_name INTO NEW.assigned_to_user_id, NEW.assigned_to
      FROM public.profiles
      WHERE (company_id = NEW.company_id OR company_id IS NULL)
        AND role IN ('technician', 'admin', 'developer')
      ORDER BY RANDOM() LIMIT 1;

    ELSIF act_type = 'set_priority' THEN
      IF act_target IN ('urgent', 'high', 'medium', 'low') THEN
        NEW.priority := act_target;
      END IF;
    END IF;

    EXIT; -- First matching rule wins for routing
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Dedicated Logging Trigger (AFTER INSERT)
-- This safely handles logs because the ticket row now exists
CREATE OR REPLACE FUNCTION public.fn_log_automation_results()
RETURNS TRIGGER AS $$
DECLARE
  rule_rec       RECORD;
  is_match       BOOLEAN;
  field_value    TEXT;
  cond_field     TEXT;
  cond_op        TEXT;
  cond_val       TEXT;
  act_type       TEXT;
  act_target     TEXT;
  company_is_vip BOOLEAN;
BEGIN
  SELECT is_vip INTO company_is_vip FROM public.companies WHERE id = NEW.company_id;

  FOR rule_rec IN
    SELECT * FROM public.routing_rules
    WHERE (company_id = NEW.company_id OR company_id IS NULL)
      AND is_active = true
    ORDER BY priority ASC
  LOOP
    is_match   := false;
    cond_field := rule_rec.conditions->>'field';
    cond_op    := rule_rec.conditions->>'operator';
    cond_val   := rule_rec.conditions->>'value';

    CASE cond_field
      WHEN 'category'   THEN field_value := NEW.category;
      WHEN 'priority'   THEN field_value := NEW.priority;
      WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
      WHEN 'is_vip'     THEN field_value := CASE WHEN company_is_vip THEN 'true' ELSE 'false' END;
      ELSE                   field_value := NULL;
    END CASE;

    IF field_value IS NOT NULL AND cond_op IS NOT NULL AND cond_val IS NOT NULL THEN
      IF cond_op = 'equals'     THEN is_match := (LOWER(field_value) = LOWER(cond_val));
      ELSIF cond_op = 'contains' THEN is_match := (field_value ILIKE '%' || cond_val || '%');
      END IF;
    END IF;

    IF NOT is_match THEN CONTINUE; END IF;

    act_type := rule_rec.actions->>'type';
    
    INSERT INTO public.automation_logs (rule_id, ticket_id, rule_name, action_type, action_result)
    VALUES (rule_rec.id, NEW.id, rule_rec.name, act_type, 'Regra aplicada com sucesso');
    
    EXIT;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_automation ON public.tickets;
CREATE TRIGGER tr_log_automation
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_automation_results();
