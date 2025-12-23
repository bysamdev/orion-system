-- 1. Criar tabela de planos
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_users integer NOT NULL,
  price decimal(10, 2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura para todos autenticados
CREATE POLICY "Authenticated users can view plans"
ON public.plans
FOR SELECT
TO authenticated
USING (true);

-- Apenas developers podem modificar planos
CREATE POLICY "Developers can manage plans"
ON public.plans
FOR ALL
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- 2. Inserir os 3 planos padrão
INSERT INTO public.plans (name, max_users, price) VALUES
  ('Starter', 20, 0),
  ('Business', 50, 99.90),
  ('Enterprise', 1000000, 299.90);

-- 3. Adicionar coluna current_plan_id na tabela companies
ALTER TABLE public.companies
ADD COLUMN current_plan_id uuid REFERENCES public.plans(id);

-- 4. Definir plano Starter como padrão para empresas existentes
UPDATE public.companies
SET current_plan_id = (SELECT id FROM public.plans WHERE name = 'Starter' LIMIT 1)
WHERE current_plan_id IS NULL;

-- 5. Criar função para verificar limites do plano
CREATE OR REPLACE FUNCTION public.check_plan_limits_on_user_create()
RETURNS TRIGGER
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
  FROM companies c
  WHERE c.id = NEW.company_id;
  
  -- Se não tem plano definido, usar Starter como fallback
  IF company_plan_id IS NULL THEN
    SELECT id INTO company_plan_id
    FROM plans
    WHERE name = 'Starter'
    LIMIT 1;
  END IF;
  
  -- Buscar limite de usuários do plano
  SELECT max_users INTO plan_max_users
  FROM plans
  WHERE id = company_plan_id;
  
  -- Contar usuários atuais da empresa
  SELECT COUNT(*) INTO current_user_count
  FROM profiles
  WHERE company_id = NEW.company_id;
  
  -- Verificar se atingiu o limite
  IF current_user_count >= plan_max_users THEN
    RAISE EXCEPTION 'Limite de usuários do plano atingido (% de %). Faça upgrade para adicionar mais membros.', current_user_count, plan_max_users;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Criar trigger BEFORE INSERT na tabela profiles
CREATE TRIGGER trigger_check_plan_limits
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_plan_limits_on_user_create();

-- 7. Criar função RPC para buscar uso do plano da empresa
CREATE OR REPLACE FUNCTION public.get_company_plan_usage()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  user_company_id uuid;
  user_role text;
BEGIN
  -- Obter company_id do usuário
  SELECT company_id INTO user_company_id FROM profiles WHERE id = auth.uid();
  
  -- Verificar role do usuário
  SELECT role INTO user_role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Apenas admin, technician ou developer podem ver essa informação
  IF user_role NOT IN ('admin', 'technician', 'developer') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  -- Buscar informações do plano e contagem
  SELECT json_build_object(
    'plan_name', COALESCE(p.name, 'Starter'),
    'max_users', COALESCE(p.max_users, 20),
    'current_users', (SELECT COUNT(*) FROM profiles WHERE company_id = user_company_id),
    'company_id', user_company_id
  ) INTO result
  FROM companies c
  LEFT JOIN plans p ON p.id = c.current_plan_id
  WHERE c.id = user_company_id;
  
  RETURN COALESCE(result, json_build_object(
    'plan_name', 'Starter',
    'max_users', 20,
    'current_users', 0,
    'company_id', user_company_id
  ));
END;
$$;