-- Trigger for Automatic Routing of Tickets based on Routing Rules

CREATE OR REPLACE FUNCTION public.fn_auto_route_ticket()
RETURNS TRIGGER AS $$
DECLARE
    rule_record RECORD;
    matching_rule_id UUID;
    rule_action_type TEXT;
    rule_action_target TEXT;
    condition_field TEXT;
    condition_operator TEXT;
    condition_value TEXT;
    is_match BOOLEAN;
    field_value TEXT;
BEGIN
    -- Only route on ticket creation
    IF TG_OP = 'INSERT' THEN
        -- Loop through active rules for the company ordered by priority
        FOR rule_record IN 
            SELECT * FROM public.routing_rules 
            WHERE company_id = NEW.company_id AND is_active = true 
            ORDER BY priority ASC
        LOOP
            is_match := false;
            condition_field := rule_record.conditions->>'field';
            condition_operator := rule_record.conditions->>'operator';
            condition_value := rule_record.conditions->>'value';

            -- Get the value of the field from the NEW ticket
            CASE condition_field
                WHEN 'category' THEN field_value := NEW.category;
                WHEN 'priority' THEN field_value := NEW.priority;
                WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
                ELSE field_value := NULL;
            END CASE;

            -- Check if condition matches
            IF field_value IS NOT NULL THEN
                IF condition_operator = 'equals' THEN
                    is_match := (field_value = condition_value);
                ELSIF condition_operator = 'contains' THEN
                    is_match := (field_value ILIKE '%' || condition_value || '%');
                END IF;
            END IF;

            -- If match found, apply action and exit loop
            IF is_match THEN
                rule_action_type := rule_record.actions->>'type';
                rule_action_target := rule_record.actions->>'target';

                IF rule_action_type = 'assign_to_user' THEN
                    NEW.assigned_to_user_id := rule_action_target::UUID;
                    -- Get the full name for the assigned_to field
                    SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id = NEW.assigned_to_user_id;
                ELSIF rule_action_type = 'round_robin' THEN
                    -- Simple round robin: assign to a random active technician for now
                    -- (In production, this would track the last assigned tech)
                    SELECT id, full_name INTO NEW.assigned_to_user_id, NEW.assigned_to 
                    FROM public.profiles 
                    WHERE company_id = NEW.company_id AND role IN ('technician', 'admin', 'developer')
                    ORDER BY RANDOM() LIMIT 1;
                ELSIF rule_action_type = 'escalate_manager' THEN
                    -- Assign to a manager or specific role if needed
                    -- For now, we can just flag it or assign to a pre-defined manager ID in the action_target
                    IF rule_action_target IS NOT NULL AND rule_action_target <> '' THEN
                        NEW.assigned_to_user_id := rule_action_target::UUID;
                        SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id = NEW.assigned_to_user_id;
                    END IF;
                END IF;

                -- Record which rule was applied for audit/debugging if needed
                -- (Maybe add an audit log entry here)
                
                EXIT; -- Stop at the first matching rule
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_auto_route_ticket ON public.tickets;
CREATE TRIGGER tr_auto_route_ticket
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_route_ticket();
