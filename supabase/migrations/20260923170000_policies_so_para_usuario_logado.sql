-- Fase 7 da auditoria (lint 0028 do advisor): as funções auxiliares da RLS
-- rodam como SECURITY DEFINER e podiam ser chamadas sem login pela API
-- (/rest/v1/rpc/has_role etc.), revelando papel e empresa de qualquer uuid.
--
-- Não dava para revogar direto: 59 policies estavam criadas "TO public", e o
-- visitante sem login também avalia essas policies, então chamaria a função e
-- receberia erro de permissão em vez de lista vazia. Todas dependem de
-- auth.uid(), ou seja, nunca liberaram nada para quem não está logado. Passar
-- para "TO authenticated" não muda o acesso de ninguém logado; o visitante
-- simplesmente deixa de avaliá-las.

-- Em vez de listar as 59 pelo nome, percorre as que existirem: o resultado
-- em produção é o mesmo, e o replay do zero da CI não quebra se algum nome
-- divergir. Só entram policies do schema public que dependem de auth.uid().
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND roles = '{public}'
       AND coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\.uid\(\)'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Agora sim: as auxiliares deixam de ser chamáveis sem login.
REVOKE EXECUTE ON FUNCTION public.eh_usuario_de_maquina(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ticket_company_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_equipe_interna(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_master_company_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ticket_belongs_to_user_company(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_usuario_de_maquina(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ticket_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_equipe_interna(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_company_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_belongs_to_user_company(uuid, uuid) TO authenticated, service_role;
