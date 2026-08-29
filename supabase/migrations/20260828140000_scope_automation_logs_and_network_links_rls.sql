-- Migration: scope_automation_logs_and_network_links_rls
--
-- Registra no repositório as correções aplicadas diretamente em produção
-- (via MCP) em 2026-08-28, ao investigar 404/500 recorrentes causados por
-- migrations não aplicadas (20260318120000_automation_engine_v2.sql e
-- 20260812000000_network_links_complete.sql nunca rodaram no banco).
--
-- Não edita as migrations antigas (histórico já aplicado não se reescreve):
-- cria uma nova, idempotente, com o texto exato que rodou em produção.
--
-- automation_logs:
--   Policy original referenciava public.profiles.role, coluna que não
--   existe (role vive em user_roles) -- teria falhado ao aplicar. Corrigida
--   para has_role()/get_user_company_id(), e escopada por empresa (original
--   não tinha nenhum escopo -- qualquer admin via qualquer empresa).
--   Sem policy de INSERT: só a trigger SECURITY DEFINER escreve aqui, que
--   bypassa RLS por natureza -- não há necessidade de abrir INSERT para
--   'authenticated' (original tinha WITH CHECK (true), permitindo qualquer
--   usuário logado forjar linha de log via REST direto).
--
-- network_links:
--   As 4 policies (select/insert/update/delete) tinham USING(true) /
--   WITH CHECK(true) -- qualquer usuário autenticado lia, criava, editava
--   ou apagava links de rede de qualquer empresa via REST direto, mesma
--   classe de furo cross-tenant já corrigida em SEC-01/02/05. Reescritas
--   escopadas por empresa, mesmo padrão do resto do schema.
--
-- Não mexe em fn_auto_route_ticket nem nas demais partes de
-- automation_engine_v2.sql (companies.is_vip, routing_rules.description):
-- produção já tem uma versão pós-fix da trigger diferente da migration
-- original: reaplicar o arquivo inteiro regrediria esse fix já em vigor.

-- ─── automation_logs ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and devs can view automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "System can insert automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Company-scoped automation log access" ON public.automation_logs;

CREATE POLICY "Company-scoped automation log access"
  ON public.automation_logs FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'developer'::app_role)
    OR is_master_company_user(auth.uid())
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND ticket_id IN (SELECT id FROM public.tickets WHERE company_id = get_user_company_id(auth.uid()))
    )
  );

-- ─── network_links ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can select network_links" ON public.network_links;
CREATE POLICY "Company-scoped select network_links"
    ON public.network_links FOR SELECT
    TO authenticated
    USING (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR company_id = get_user_company_id(auth.uid())
    );

DROP POLICY IF EXISTS "Authenticated users can insert network_links" ON public.network_links;
CREATE POLICY "Company-scoped insert network_links"
    ON public.network_links FOR INSERT
    TO authenticated
    WITH CHECK (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR (
        (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
        AND company_id = get_user_company_id(auth.uid())
      )
    );

DROP POLICY IF EXISTS "Authenticated users can update network_links" ON public.network_links;
CREATE POLICY "Company-scoped update network_links"
    ON public.network_links FOR UPDATE
    TO authenticated
    USING (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR (
        (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
        AND company_id = get_user_company_id(auth.uid())
      )
    )
    WITH CHECK (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR (
        (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
        AND company_id = get_user_company_id(auth.uid())
      )
    );

DROP POLICY IF EXISTS "Authenticated users can delete network_links" ON public.network_links;
CREATE POLICY "Company-scoped delete network_links"
    ON public.network_links FOR DELETE
    TO authenticated
    USING (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR (
        (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
        AND company_id = get_user_company_id(auth.uid())
      )
    );
