-- Cria profiles para usuários existentes que não têm profile
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuário'),
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Cria roles padrão (customer) para usuários existentes que não têm role
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  'customer'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;