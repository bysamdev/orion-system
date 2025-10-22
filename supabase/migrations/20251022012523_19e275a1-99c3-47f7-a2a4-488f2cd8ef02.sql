-- Criar função para verificar se usuário pertence à empresa master (Orion System)
CREATE OR REPLACE FUNCTION public.is_master_company_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN companies c ON c.id = p.company_id
    WHERE p.id = _user_id
      AND c.name = 'Orion System'
  )
$$;

-- Remover políticas antigas de visualização de empresas
DROP POLICY IF EXISTS "Admins can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

-- Criar novas políticas que permitem empresa master ver todas
CREATE POLICY "Users from master company can view all companies"
ON public.companies
FOR SELECT
USING (
  is_master_company_user(auth.uid())
);

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = get_user_company_id(auth.uid())
);

-- Permitir que empresa master crie, atualize e delete empresas
CREATE POLICY "Master company admins can insert companies"
ON public.companies
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master company admins can update companies"
ON public.companies
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master company admins can delete companies"
ON public.companies
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);