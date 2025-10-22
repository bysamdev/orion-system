-- Atualizar políticas de profiles para empresa master ver todos

-- Remover políticas antigas de visualização
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Criar novas políticas que permitem empresa master ver todos os perfis
CREATE POLICY "Master company users can view all profiles"
ON public.profiles
FOR SELECT
USING (
  is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Remover políticas antigas de atualização e exclusão
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their company" ON public.profiles;

-- Criar políticas de atualização para empresa master
CREATE POLICY "Master company admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Criar políticas de exclusão para empresa master
CREATE POLICY "Master company admins can delete all profiles"
ON public.profiles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can delete profiles in their company"
ON public.profiles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Atualizar políticas de user_roles para empresa master gerenciar todos os roles

-- Remover políticas antigas de visualização de roles
DROP POLICY IF EXISTS "Admins can view roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

-- Criar novas políticas de visualização
CREATE POLICY "Master company users can view all roles"
ON public.user_roles
FOR SELECT
USING (
  is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Remover políticas antigas de inserção, atualização e exclusão de roles
DROP POLICY IF EXISTS "Admins can insert roles for users in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in their company" ON public.user_roles;

-- Criar políticas de inserção para empresa master
CREATE POLICY "Master company admins can insert any role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can insert roles for users in their company"
ON public.user_roles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Criar políticas de atualização para empresa master
CREATE POLICY "Master company admins can update any role"
ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can update roles in their company"
ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Criar políticas de exclusão para empresa master
CREATE POLICY "Master company admins can delete any role"
ON public.user_roles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

CREATE POLICY "Admins can delete roles in their company"
ON public.user_roles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);