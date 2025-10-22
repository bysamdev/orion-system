-- Corrigir foreign keys duplicadas que estão causando erro 300 nas queries

-- Remover foreign keys duplicadas (mantendo as originais que funcionavam antes)
DO $$ 
BEGIN
  -- Remover as FKs que adicionamos se elas existirem
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_user_id') THEN
    ALTER TABLE public.tickets DROP CONSTRAINT fk_tickets_user_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_assigned_to_user_id') THEN
    ALTER TABLE public.tickets DROP CONSTRAINT fk_tickets_assigned_to_user_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ticket_updates_ticket_id') THEN
    ALTER TABLE public.ticket_updates DROP CONSTRAINT fk_ticket_updates_ticket_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ticket_updates_author_id') THEN
    ALTER TABLE public.ticket_updates DROP CONSTRAINT fk_ticket_updates_author_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_profiles_company_id') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT fk_profiles_company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_departments_company_id') THEN
    ALTER TABLE public.departments DROP CONSTRAINT fk_departments_company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_roles_user_id') THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT fk_user_roles_user_id;
  END IF;
END $$;