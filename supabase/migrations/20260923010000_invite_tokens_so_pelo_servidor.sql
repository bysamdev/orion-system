-- ORN-SEC-04: invite_tokens só pode ser lido e gravado pelo servidor.
--
-- A policy "Admins can create tokens" deixava qualquer admin ou developer
-- inserir um token para qualquer e-mail, escolhendo o próprio valor e a
-- validade. Com ele, a rota pública reset-password-with-token trocava a senha
-- da conta dona do e-mail: tomada de conta de qualquer usuário, inclusive
-- developer. A policy de SELECT ainda deixava a equipe da empresa mãe ler
-- tokens válidos de outras pessoas, com o mesmo efeito.
--
-- Os únicos usos legítimos são do servidor: invite-user-resend grava com a
-- service role, e reset-password-with-token (Edge com service role e Go com
-- conexão direta) lê e apaga. O frontend não acessa a tabela.

DROP POLICY IF EXISTS "Admins can create tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Admins and developers can view company invite tokens" ON public.invite_tokens;

REVOKE ALL ON public.invite_tokens FROM anon, authenticated;

-- RLS continua ligado e sem policy: anon e authenticated não enxergam nada,
-- mesmo que alguém devolva um GRANT por engano.
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
