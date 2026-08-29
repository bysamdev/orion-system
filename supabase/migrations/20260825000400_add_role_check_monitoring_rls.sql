-- =================================================================================
-- Migration: 20260825000400_add_role_check_monitoring_rls.sql
-- Descrição: monitored_endpoints e network_links tinham RLS de mutação
-- isolada só por company_id, sem checar papel -- o backend Go restringe
-- pra admin/technician/developer, mas o PostgREST direto (supabase-js)
-- deixava qualquer usuário da empresa (inclusive customer) inserir, alterar
-- ou apagar alvos de monitoramento e links de rede. Leitura continua aberta
-- pra qualquer usuário da própria empresa; só mutação passa a exigir papel.
-- =================================================================================

-- monitored_endpoints: mantém SELECT como está, endurece INSERT/UPDATE/DELETE.
-- Nomes de policy abaixo conferidos contra o estado real do banco de
-- produção antes de aplicar (não os nomes originais da migration de
-- criação -- outra correção já rodou em cima e renomeou).
DROP POLICY IF EXISTS "Users can insert company endpoints" ON monitored_endpoints;
DROP POLICY IF EXISTS "Users can insert their company endpoints" ON monitored_endpoints;
CREATE POLICY "Staff can insert their company endpoints"
    ON monitored_endpoints FOR INSERT
    WITH CHECK (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
    );

DROP POLICY IF EXISTS "Users can update company endpoints" ON monitored_endpoints;
DROP POLICY IF EXISTS "Users can update their company endpoints" ON monitored_endpoints;
CREATE POLICY "Staff can update their company endpoints"
    ON monitored_endpoints FOR UPDATE
    USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
    );

DROP POLICY IF EXISTS "Users can delete company endpoints" ON monitored_endpoints;
DROP POLICY IF EXISTS "Users can delete their company endpoints" ON monitored_endpoints;
CREATE POLICY "Staff can delete their company endpoints"
    ON monitored_endpoints FOR DELETE
    USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
    );

-- network_links: a policy "Authenticated users can manage own company network_links"
-- era FOR ALL (cobria SELECT junto com mutação). Substitui por uma policy
-- de SELECT (mantém leitura aberta pra empresa) e uma de mutação com papel.
DROP POLICY IF EXISTS "Authenticated users can manage own company network_links" ON public.network_links;

CREATE POLICY "Users can view own company network_links"
ON public.network_links FOR SELECT TO authenticated
USING (
    company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid())
);

CREATE POLICY "Staff can manage own company network_links"
ON public.network_links FOR INSERT TO authenticated
WITH CHECK (
    (company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
);

CREATE POLICY "Staff can update own company network_links"
ON public.network_links FOR UPDATE TO authenticated
USING (
    (company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
)
WITH CHECK (
    (company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
);

CREATE POLICY "Staff can delete own company network_links"
ON public.network_links FOR DELETE TO authenticated
USING (
    (company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
);
