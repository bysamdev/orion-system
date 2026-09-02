-- =============================================================================
-- Migration: 20260901220000_fix_p0_authorization_and_rls.sql
--
-- Descrição:
-- 1. Cria helper centralizador is_equipe_interna(_user_id) — ponto único de
--    decisão de escopo cross-company. Admin interno = role admin + empresa
--    com is_master = true (ou sem empresa vinculada). Técnicos e developers
--    são sempre equipe interna.
-- 2. Revoga acesso PostgREST da RPC get_decrypted_remote_password, que não
--    possui chamadores no código (auditoria confirma 0 chamadores).
-- 3. Corrige time_entries: a policy de 20260825000500 bloqueava técnicos de
--    apontar horas em tickets de clientes atendidos. Reescrita no padrão
--    unificado: equipe interna pode apontar horas em qualquer ticket.
-- 4. contracts, sla_configs: Consolida as duas policies de SELECT separadas
--    (admin + technician) em uma única policy no padrão unificado.
-- 5. canned_responses: Consolida o SELECT no padrão unificado.
-- 6. knowledge_base_articles: Consolida as policies de SELECT para equipe
--    interna e clientes no padrão unificado.
-- 7. monitored_endpoints: Corrige o SELECT para equipe interna ter acesso
--    global. INSERT/UPDATE/DELETE mantidos porque o controle de escopo é
--    feito no handler Go (uptime_handlers.go).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper centralizador de equipe interna
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_equipe_interna(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.id = _user_id
      AND (
        ur.role IN ('developer'::app_role, 'technician'::app_role)
        OR (ur.role = 'admin'::app_role AND (c.is_master = true OR p.company_id IS NULL))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_equipe_interna(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Revogar PostgREST da RPC de senha remota (0 chamadores confirmados)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_decrypted_remote_password(uuid) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. time_entries — equipe interna aponta horas em qualquer chamado
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Technicians can manage own time_entries" ON public.time_entries;

CREATE POLICY "Equipe interna e clientes gerenciam apontamentos de horas"
ON public.time_entries
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    is_equipe_interna(auth.uid())
    OR get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    is_equipe_interna(auth.uid())
    OR get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 4. contracts — unificar SELECT de admin + technician em policy única
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view company contracts" ON public.contracts;
DROP POLICY IF EXISTS "Technicians can view company contracts" ON public.contracts;

CREATE POLICY "Usuarios podem ver contratos da empresa"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR is_equipe_interna(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 5. sla_configs — unificar SELECT de admin + technician em policy única
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view company sla_configs" ON public.sla_configs;
DROP POLICY IF EXISTS "Technicians can view company sla_configs" ON public.sla_configs;

CREATE POLICY "Usuarios podem ver configuracoes de SLA da empresa"
ON public.sla_configs
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR is_equipe_interna(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 6. canned_responses — consolidar SELECT no padrão unificado
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Technicians and admins can view company canned responses" ON public.canned_responses;

CREATE POLICY "Usuarios podem ver respostas prontas da empresa"
ON public.canned_responses
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR is_equipe_interna(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 7. knowledge_base_articles — consolidar SELECT no padrão unificado
--    Equipe interna vê tudo. Clientes veem apenas artigos públicos publicados
--    da sua própria empresa.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Techs can view company kb_articles" ON public.knowledge_base_articles;
DROP POLICY IF EXISTS "Admins and techs can manage company kb_articles" ON public.knowledge_base_articles;
DROP POLICY IF EXISTS "Customers can view public published kb_articles" ON public.knowledge_base_articles;

CREATE POLICY "Equipe interna gerencia artigos da base de conhecimento"
ON public.knowledge_base_articles
FOR ALL
TO authenticated
USING (is_equipe_interna(auth.uid()))
WITH CHECK (is_equipe_interna(auth.uid()));

CREATE POLICY "Clientes visualizam artigos publicos publicados da propria empresa"
ON public.knowledge_base_articles
FOR SELECT
TO authenticated
USING (
  NOT is_equipe_interna(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
  AND is_public = true
  AND status = 'published'
);

-- ---------------------------------------------------------------------------
-- 8. monitored_endpoints — equipe interna faz SELECT global
--    INSERT/UPDATE/DELETE: escopo controlado no handler Go.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their company endpoints" ON public.monitored_endpoints;

CREATE POLICY "Usuarios podem ver endpoints monitorados da empresa"
ON public.monitored_endpoints
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR is_equipe_interna(auth.uid())
);
