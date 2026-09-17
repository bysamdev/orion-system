-- =================================================================================
-- Migration: 20260916210000_abertura_de_chamado_exige_login_individual.sql
--
-- APLICADA EM 2026-09-16 (em duas etapas no banco: a policy e, logo depois, o
-- reforço de eh_usuario_de_maquina olhar auth.users. Este arquivo traz o
-- estado final das duas).
--
-- Demanda "Abrir chamados somente gestores/responsáveis", item P0.
--
-- ---------------------------------------------------------------------------
-- O que estava aberto
--
-- A policy anterior ("Customers can create tickets") validava APENAS
-- user_id = auth.uid(). Duas consequências, ambas exploráveis:
--
--   1. company_id vinha do frontend sem validação nenhuma (NewTicket.tsx manda
--      profile.company_id, mas nada no banco exigia isso) — um autenticado
--      podia gravar chamado dentro de outra empresa;
--   2. o usuário-fantasma criado por GET /api/auth/machine-login (clique em
--      "Abrir Chamado" na bandeja do agente Windows, sem login individual)
--      passava na policy como qualquer outro usuário.
--
-- ---------------------------------------------------------------------------
-- A regra agora
--
--   equipe interna (admin/technician/developer) -> abre para qualquer empresa
--   demais usuários                             -> só na própria empresa
--   usuário-fantasma de máquina                 -> nunca
--
-- Papel e não is_master_company_user: companies.is_master hoje marca iBReady e
-- Orion System como master e bysamdev (onde estão admin e developer) como
-- não-master. Amarrar a abertura a esse campo deixaria a regra dependendo de um
-- dado que não descreve quem é a equipe interna. Gestor e técnico são papéis
-- GLOBAIS por decisão de produto (2026-09-16); o isolamento por empresa vale
-- para o usuário final.
--
-- ---------------------------------------------------------------------------
-- O que esta migration deliberadamente NÃO faz
--
-- Não fecha os canais que rodam com service_role e portanto ignoram RLS:
-- lib.AbrirChamadoAlertaServidor (chamado automático de alerta RMM) e as edge
-- functions email-to-ticket e whatsapp-webhook. Os três seguem abrindo chamado
-- sem passar por esta regra — registrado como dívida, não como esquecimento.
-- =================================================================================

-- eh_usuario_de_maquina identifica o fantasma criado por machineLogin
-- (handler/auth_handlers.go), cujo e-mail vem de lib.MachineGhostEmail —
-- formato travado byte a byte por TestMachineGhostEmail.
--
-- Olha profiles E auth.users: machineLogin grava profiles.email só na criação
-- e descarta o erro de UpdateProfile de propósito (uma falha ali não pode
-- derrubar o login). Um perfil sem e-mail faria a checagem devolver false e o
-- token voltaria a abrir chamado; auth.users.email é a identidade que o
-- próprio machineLogin cria via AdminCreateUser, sem escrita best-effort no
-- caminho.
CREATE OR REPLACE FUNCTION public.eh_usuario_de_maquina(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = _user_id
      AND email LIKE 'machine-%@orion.internal'
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND email LIKE 'machine-%@orion.internal'
  );
$$;

COMMENT ON FUNCTION public.eh_usuario_de_maquina(uuid) IS
  'Identifica o usuário-fantasma criado por machine-login (lib.MachineGhostEmail). Usado para impedir que o token do agente abra chamado.';

DROP POLICY IF EXISTS "Customers can create tickets" ON public.tickets;

CREATE POLICY "Abertura exige login proprio e empresa propria"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND NOT public.eh_usuario_de_maquina((SELECT auth.uid()))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'technician'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'developer'::public.app_role)
    OR company_id = public.get_user_company_id((SELECT auth.uid()))
  )
);
