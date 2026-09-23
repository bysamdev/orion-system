-- ORN-SEC-27 / ORN-INC-01: o usuário logado tinha UPDATE em todas as colunas
-- do próprio perfil. Podia trocar o e-mail (o email-to-ticket identifica o
-- remetente por profiles.email e passava a abrir chamados em nome de quem
-- tivesse aquele e-mail), reativar o próprio status e mexer em
-- last_assigned_at, que alimenta o rodízio de atribuição.
--
-- A tela de perfil só grava nome, departamento, telefone e foto. Mudanças
-- administrativas passam pela Edge admin-update-user (service_role), que não
-- é afetada.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, department, phone, avatar_url, updated_at) ON public.profiles TO authenticated;
