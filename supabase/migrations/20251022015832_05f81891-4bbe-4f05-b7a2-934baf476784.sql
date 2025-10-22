-- Inserir o perfil do usuário atual
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
VALUES (
  '6930603c-135e-4d57-9645-ff96f1ba69c6',
  'samterres42@gmail.com',
  'Samuel Terres de Moura',
  now(),
  now()
);

-- Inserir a role de admin para o usuário
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES (
  '6930603c-135e-4d57-9645-ff96f1ba69c6',
  'admin'::app_role,
  now()
);

-- Criar trigger para automaticamente criar profile quando um usuário se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();