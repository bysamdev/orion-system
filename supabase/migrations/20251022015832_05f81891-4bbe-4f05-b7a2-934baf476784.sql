-- Semeadura de dados presa a um usuário real: profiles.id tem FK para
-- auth.users(id), e em banco limpo auth.users está vazia, então o INSERT
-- aborta com 23503 (profiles_id_fkey). Em produção a conta existe e os dois
-- INSERTs rodam exatamente como sempre rodaram — o guarda é transparente lá.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '6930603c-135e-4d57-9645-ff96f1ba69c6') THEN
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
  ELSE
    RAISE NOTICE 'Conta 6930603c-... ausente em auth.users — semeadura de profile/admin pulada (esperado em banco limpo)';
  END IF;
END $$;

-- Criar trigger para automaticamente criar profile quando um usuário se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();