-- Corrige tr_auto_route_ticket() — a função REALMENTE presa ao trigger
-- AFTER INSERT em public.tickets (tr_auto_route_ticket). O AUDIT.md
-- descrevia um bug em fn_auto_route_ticket()/BEFORE INSERT, mas essa
-- função está no banco sem nenhum trigger apontando pra ela (código
-- morto) — a que roda de verdade é essa aqui, e o bug real é outro e
-- mais grave:
--
--   UPDATE tickets SET assigned_to_user_id = (regra.actions->>'target')::uuid
--
-- ...executado incondicionalmente para QUALQUER regra que casar a
-- condição, sem checar regra.actions->>'type'. Hoje as 7 regras ativas
-- são todas assign_to_user/escalate_manager com target = UUID válido,
-- então nada quebra. Mas 'round_robin', 'set_priority' e 'notify_all'
-- (todos oferecidos na tela de RoutingRulesManagement) não guardam um
-- UUID em target — o cast ::uuid falha com "invalid input syntax for
-- type uuid", e isso propaga como erro no INSERT em tickets, ou seja,
-- o cliente literalmente não consegue abrir o chamado se uma regra
-- desse tipo passar a casar a condição.
--
-- Esta migration reescreve a função para: (1) checar actions->>'type'
-- antes de qualquer cast, (2) implementar round_robin e set_priority
-- de verdade em vez de deixá-los quebrar, (3) manter assign_to_user/
-- assign_tech/escalate_manager funcionando exatamente como hoje,
-- (4) permitir regras globais (company_id IS NULL), alinhado ao que
-- fn_auto_route_ticket() já previa nos arquivos de migration.
CREATE OR REPLACE FUNCTION public.tr_auto_route_ticket()
RETURNS TRIGGER AS $$
DECLARE
  regra RECORD;
  matched BOOLEAN := false;
  field_value TEXT;
  action_type TEXT;
  action_target TEXT;
BEGIN
  FOR regra IN
    SELECT * FROM routing_rules
    WHERE is_active = true
      AND (company_id = NEW.company_id OR company_id IS NULL)
    ORDER BY priority ASC
  LOOP
    CASE regra.conditions->>'field'
        WHEN 'category' THEN field_value := NEW.category;
        WHEN 'priority' THEN field_value := NEW.priority;
        WHEN 'company_id' THEN field_value := NEW.company_id::TEXT;
        ELSE field_value := NULL;
    END CASE;

    IF field_value IS NULL
       OR regra.conditions->>'operator' <> 'equals'
       OR LOWER(field_value) <> LOWER(regra.conditions->>'value') THEN
      CONTINUE;
    END IF;

    action_type := regra.actions->>'type';
    action_target := regra.actions->>'target';

    IF action_type IN ('assign_to_user', 'assign_tech', 'escalate_manager')
       AND action_target ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      UPDATE tickets SET assigned_to_user_id = action_target::uuid WHERE id = NEW.id;
      UPDATE tickets t SET assigned_to = p.full_name
      FROM profiles p
      WHERE t.id = NEW.id AND p.id = action_target::uuid;
      matched := true;
      EXIT;

    ELSIF action_type = 'round_robin' THEN
      UPDATE tickets t SET assigned_to_user_id = p.id, assigned_to = p.full_name
      FROM (
        SELECT id, full_name FROM profiles
        WHERE (company_id = NEW.company_id OR company_id IS NULL)
          AND role IN ('technician', 'admin', 'developer')
        ORDER BY RANDOM() LIMIT 1
      ) p
      WHERE t.id = NEW.id;
      matched := true;
      EXIT;

    ELSIF action_type = 'set_priority' AND action_target IN ('urgent', 'high', 'medium', 'low') THEN
      UPDATE tickets SET priority = action_target WHERE id = NEW.id;
      -- Ajusta prioridade mas não conta como "roteado": segue avaliando
      -- regras de prioridade menor, e o fallback de atribuição abaixo
      -- ainda roda se nenhuma regra de assign/round_robin casar depois.

    END IF;
    -- notify_all / auto_response: sem ação de atribuição aqui (fora do
    -- escopo do MVP) — não trava o loop nem quebra o INSERT.
  END LOOP;

  IF NOT matched THEN
    PERFORM fn_auto_assign_ticket(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
