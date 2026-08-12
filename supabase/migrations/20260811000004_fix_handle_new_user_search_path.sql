-- Migration: Fix handle_new_user search_path and table qualification
-- Description: Sets search_path = public on all user creation triggers and schema-qualifies all table references (public.profiles, public.user_roles, public.companies, etc.) to prevent 'relation profiles does not exist' errors when called by auth service role or GoTrue.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_company_id uuid;
  target_company_id uuid;
BEGIN
  -- Check if company_id was provided in user metadata
  IF NEW.raw_user_meta_data->>'company_id' IS NOT NULL AND NEW.raw_user_meta_data->>'company_id' != '' THEN
    target_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  ELSE
    -- Get the Orion System company ID (default company for new users)
    SELECT id INTO default_company_id 
    FROM public.companies 
    WHERE name = 'Orion System' 
    LIMIT 1;
    
    target_company_id := default_company_id;
  END IF;
  
  -- Create profile with company assignment
  INSERT INTO public.profiles (id, full_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    target_company_id
  );
  
  -- Create user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_company_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role (e.g. edge functions using service role key) to bypass check
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow company_id changes only for master admins or developers
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_master_company_user(auth.uid())) 
       AND NOT public.has_role(auth.uid(), 'developer'::public.app_role) THEN
      RAISE EXCEPTION 'Only master admins can change user company assignments';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_plan_limits_on_user_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_plan_id uuid;
  plan_max_users integer;
  current_user_count integer;
BEGIN
  -- Buscar o plano da empresa
  SELECT c.current_plan_id INTO company_plan_id
  FROM public.companies c
  WHERE c.id = NEW.company_id;
  
  -- Se não tem plano definido, usar Starter como fallback
  IF company_plan_id IS NULL THEN
    SELECT id INTO company_plan_id
    FROM public.plans
    WHERE name = 'Starter'
    LIMIT 1;
  END IF;
  
  -- Buscar limite de usuários do plano
  SELECT max_users INTO plan_max_users
  FROM public.plans
  WHERE id = company_plan_id;
  
  -- Contar usuários atuais da empresa
  SELECT COUNT(*) INTO current_user_count
  FROM public.profiles
  WHERE company_id = NEW.company_id;
  
  -- Verificar se atingiu o limite
  IF plan_max_users IS NOT NULL AND current_user_count >= plan_max_users THEN
    RAISE EXCEPTION 'Limite de usuários do plano atingido (% de %). Faça upgrade para adicionar mais membros.', current_user_count, plan_max_users;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::JSONB, auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := TRIM(NEW.full_name);
  END IF;
  
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  
  IF NEW.department IS NOT NULL THEN
    NEW.department := TRIM(NEW.department);
  END IF;
  
  RETURN NEW;
END;
$$;
