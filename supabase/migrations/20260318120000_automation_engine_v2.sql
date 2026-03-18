-- ============================================================
-- ORION SYSTEM: Automation Engine v2
-- Extends routing_rules with new condition/action types,
-- adds automation_logs audit table, and VIP company flag.
-- ============================================================

-- 1. VIP flag on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false;

-- 2. description column on routing_rules (referenced in UI but was missing from DB)
ALTER TABLE public.routing_rules
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Extend action_type CHECK to include new types
-- Drop old constraint, re-add with extended list
ALTER TABLE public.routing_rules
  DROP CONSTRAINT IF EXISTS routing_rules_action_type_check;

ALTER TABLE public.routing_rules
  ADD CONSTRAINT routing_rules_action_type_check
  CHECK (action_type IN (
    'assign_tech',
    'round_robin',
    'notify_all',
    'escalate_manager',
    'set_priority',
    'auto_response'
  ));

-- 4. Automation execution log
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID REFERENCES public.routing_rules(id) ON DELETE SET NULL,
  ticket_id   UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  rule_name   TEXT,
  action_type TEXT NOT NULL,
  action_result TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_ticket   ON public.automation_logs (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule     ON public.automation_logs (rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created  ON public.automation_logs (created_at DESC);

-- RLS for automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can view automation logs"
  ON public.automation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'developer', 'technician')
    )
  );

CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Replace fn_auto_route_ticket with extended version
-- Handles: assign_tech, round_robin, escalate_manager, set_priority + logs every match
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

  -- Look up company VIP flag once (used if any rule checks is_vip)
  SELECT is_vip INTO company_is_vip
  FROM public.companies
  WHERE id = NEW.company_id;

  FOR rule_rec IN
    SELECT * FROM public.routing_rules
    WHERE company_id = NEW.company_id
      AND is_active = true
    ORDER BY priority ASC
  LOOP
    is_match   := false;
    cond_field := rule_rec.conditions->>'field';
    cond_op    := rule_rec.conditions->>'operator';
    cond_val   := rule_rec.conditions->>'value';

    -- Resolve field value from the new ticket
    CASE cond_field
      WHEN 'category'   THEN field_value := NEW.category;
      WHEN 'priority'   THEN field_value := NEW.priority;
      WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
      WHEN 'title'      THEN field_value := NEW.title;
      WHEN 'is_vip'     THEN field_value := CASE WHEN company_is_vip THEN 'true' ELSE 'false' END;
      ELSE                   field_value := NULL;
    END CASE;

    -- Evaluate operator
    IF field_value IS NOT NULL THEN
      IF cond_op = 'equals' THEN
        is_match := (LOWER(field_value) = LOWER(cond_val));
      ELSIF cond_op = 'contains' THEN
        is_match := (field_value ILIKE '%' || cond_val || '%');
      ELSIF cond_op = 'not_equals' THEN
        is_match := (LOWER(field_value) <> LOWER(cond_val));
      END IF;
    END IF;

    IF NOT is_match THEN
      CONTINUE;
    END IF;

    act_type   := rule_rec.actions->>'type';
    act_target := rule_rec.actions->>'target';

    -- Apply action
    IF act_type = 'assign_tech' OR act_type = 'assign_to_user' THEN
      NEW.assigned_to_user_id := act_target::UUID;
      SELECT full_name INTO NEW.assigned_to
      FROM public.profiles WHERE id = NEW.assigned_to_user_id;

    ELSIF act_type = 'round_robin' THEN
      SELECT id, full_name INTO NEW.assigned_to_user_id, NEW.assigned_to
      FROM public.profiles
      WHERE company_id = NEW.company_id
        AND role IN ('technician', 'admin', 'developer')
      ORDER BY RANDOM() LIMIT 1;

    ELSIF act_type = 'escalate_manager' THEN
      IF act_target IS NOT NULL AND act_target <> '' THEN
        NEW.assigned_to_user_id := act_target::UUID;
        SELECT full_name INTO NEW.assigned_to
        FROM public.profiles WHERE id = NEW.assigned_to_user_id;
      END IF;

    ELSIF act_type = 'set_priority' THEN
      -- act_target = 'urgent' | 'high' | 'medium' | 'low'
      IF act_target IN ('urgent', 'high', 'medium', 'low') THEN
        NEW.priority := act_target;
      END IF;

    -- auto_response is handled by the AFTER trigger below (needs ticket ID)
    END IF;

    -- Audit log
    INSERT INTO public.automation_logs (rule_id, ticket_id, rule_name, action_type, action_result)
    VALUES (
      rule_rec.id,
      NEW.id,
      rule_rec.name,
      act_type,
      CASE
        WHEN act_type IN ('assign_tech','assign_to_user','escalate_manager') THEN 'Atribuído a: ' || COALESCE(NEW.assigned_to, act_target)
        WHEN act_type = 'round_robin'   THEN 'Atribuído via round-robin a: ' || COALESCE(NEW.assigned_to, '?')
        WHEN act_type = 'set_priority'  THEN 'Prioridade alterada para: ' || act_target
        WHEN act_type = 'notify_all'    THEN 'Notificação enviada para todos os técnicos'
        WHEN act_type = 'auto_response' THEN 'Resposta automática agendada'
        ELSE act_type
      END
    );

    EXIT; -- First matching rule wins
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create BEFORE INSERT trigger
DROP TRIGGER IF EXISTS tr_auto_route_ticket ON public.tickets;
CREATE TRIGGER tr_auto_route_ticket
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_route_ticket();

-- 6. AFTER trigger for auto_response action
-- Posts a ticket_update with the canned response content right after creation
CREATE OR REPLACE FUNCTION public.fn_auto_response_ticket()
RETURNS TRIGGER AS $$
DECLARE
  rule_rec   RECORD;
  is_match   BOOLEAN;
  field_value TEXT;
  cond_field  TEXT;
  cond_op     TEXT;
  cond_val    TEXT;
  act_type    TEXT;
  act_target  TEXT;
  resp_content TEXT;
  company_is_vip BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT is_vip INTO company_is_vip
  FROM public.companies WHERE id = NEW.company_id;

  FOR rule_rec IN
    SELECT * FROM public.routing_rules
    WHERE company_id = NEW.company_id
      AND is_active = true
      AND actions->>'type' = 'auto_response'
    ORDER BY priority ASC
  LOOP
    cond_field := rule_rec.conditions->>'field';
    cond_op    := rule_rec.conditions->>'operator';
    cond_val   := rule_rec.conditions->>'value';
    is_match   := false;

    CASE cond_field
      WHEN 'category'   THEN field_value := NEW.category;
      WHEN 'priority'   THEN field_value := NEW.priority;
      WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
      WHEN 'title'      THEN field_value := NEW.title;
      WHEN 'is_vip'     THEN field_value := CASE WHEN company_is_vip THEN 'true' ELSE 'false' END;
      ELSE                   field_value := NULL;
    END CASE;

    IF field_value IS NOT NULL THEN
      IF cond_op = 'equals'     THEN is_match := (LOWER(field_value) = LOWER(cond_val));
      ELSIF cond_op = 'contains' THEN is_match := (field_value ILIKE '%' || cond_val || '%');
      END IF;
    END IF;

    IF NOT is_match THEN CONTINUE; END IF;

    act_target := rule_rec.actions->>'target'; -- canned_response id

    -- Fetch canned response content
    SELECT content INTO resp_content
    FROM public.canned_responses
    WHERE id = act_target::UUID;

    IF resp_content IS NOT NULL THEN
      INSERT INTO public.ticket_updates (ticket_id, content, type, is_internal, created_at)
      VALUES (NEW.id, '[Resposta Automática] ' || resp_content, 'comment', false, now());
    END IF;

    EXIT;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_response_ticket ON public.tickets;
CREATE TRIGGER tr_auto_response_ticket
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_response_ticket();
