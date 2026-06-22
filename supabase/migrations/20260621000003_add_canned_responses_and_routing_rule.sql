-- 1. Add category column to canned_responses
ALTER TABLE public.canned_responses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'geral';

-- 2. Insert standard predefined responses and default routing rule for each company
DO $$
DECLARE
    company_record RECORD;
    admin_id UUID;
    has_action_type_col BOOLEAN;
BEGIN
    -- Check if action_type column exists in routing_rules
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'routing_rules' 
          AND column_name = 'action_type'
    ) INTO has_action_type_col;

    FOR company_record IN SELECT id FROM public.companies LOOP
        -- Find an admin for the company to be the 'created_by'
        SELECT id INTO admin_id FROM public.profiles WHERE company_id = company_record.id AND role = 'admin' LIMIT 1;
        
        -- If no admin is found, find any user for that company
        IF admin_id IS NULL THEN
            SELECT id INTO admin_id FROM public.profiles WHERE company_id = company_record.id LIMIT 1;
        END IF;

        IF admin_id IS NOT NULL THEN
            -- Insert predefined responses
            INSERT INTO public.canned_responses (title, content, category, company_id, created_by)
            VALUES 
                ('Solicitação de mais informações', 'Olá! Para darmos andamento, poderia nos enviar mais detalhes sobre o problema?', 'geral', company_record.id, admin_id),
                ('Acesso remoto solicitado', 'Para resolvermos mais rápido, podemos acessar sua máquina remotamente via AnyDesk/TeamViewer?', 'geral', company_record.id, admin_id),
                ('Chamado resolvido', 'Seu chamado foi resolvido! Qualquer dúvida, estamos à disposição.', 'geral', company_record.id, admin_id)
            ON CONFLICT DO NOTHING;

            -- Add routing rule for tickets without a specific routing category ("outros")
            IF has_action_type_col THEN
                INSERT INTO public.routing_rules (company_id, name, description, priority, conditions, actions, action_type)
                VALUES (
                    company_record.id,
                    'Atribuição Padrão (Sem Categoria)',
                    'Ao abrir ticket sem categoria específica, atribuir automaticamente ao agente disponível.',
                    999, -- Low priority so it runs after all other rules
                    '{"field": "category", "operator": "equals", "value": "outros"}'::jsonb,
                    '{"type": "round_robin"}'::jsonb,
                    'round_robin'
                );
            ELSE
                INSERT INTO public.routing_rules (company_id, name, description, priority, conditions, actions)
                VALUES (
                    company_record.id,
                    'Atribuição Padrão (Sem Categoria)',
                    'Ao abrir ticket sem categoria específica, atribuir automaticamente ao agente disponível.',
                    999, -- Low priority so it runs after all other rules
                    '{"field": "category", "operator": "equals", "value": "outros"}'::jsonb,
                    '{"type": "round_robin"}'::jsonb
                );
            END IF;
        END IF;
    END LOOP;
END
$$;
