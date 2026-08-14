-- =================================================================================
-- Migration: Security Hardening & Resolving Supabase Linter Warnings
-- Resolves: function_search_path_mutable, rls_policy_always_true, 
--           anon_security_definer_function_executable,
--           authenticated_security_definer_function_executable, extension_in_public
-- =================================================================================

-- ---------------------------------------------------------------------------------
-- 1. Fix Dangerous RLS Policies (USING true)
-- ---------------------------------------------------------------------------------

-- 1.1 Invite Tokens: Remove permissive delete permission from authenticated
DROP POLICY IF EXISTS "Service role can delete tokens" ON public.invite_tokens;

-- 1.2 Machine Alerts: Replace permissive CRUD with tenant-isolated CRUD
DROP POLICY IF EXISTS "Authenticated users can delete machine_alerts" ON public.machine_alerts;
DROP POLICY IF EXISTS "Authenticated users can insert machine_alerts" ON public.machine_alerts;
DROP POLICY IF EXISTS "Authenticated users can update machine_alerts" ON public.machine_alerts;
DROP POLICY IF EXISTS "Authenticated users can view machine_alerts" ON public.machine_alerts;

CREATE POLICY "Authenticated users can manage own company machine_alerts"
ON public.machine_alerts FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.machines m 
        WHERE m.id = machine_alerts.machine_id 
        AND (m.company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.machines m 
        WHERE m.id = machine_alerts.machine_id 
        AND (m.company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()))
    )
);

-- 1.3 Network Links: Replace permissive CRUD with tenant-isolated CRUD
DROP POLICY IF EXISTS "Authenticated users can delete network_links" ON public.network_links;
DROP POLICY IF EXISTS "Authenticated users can insert network_links" ON public.network_links;
DROP POLICY IF EXISTS "Authenticated users can update network_links" ON public.network_links;
DROP POLICY IF EXISTS "Authenticated users can select network_links" ON public.network_links;

CREATE POLICY "Authenticated users can manage own company network_links"
ON public.network_links FOR ALL TO authenticated
USING (
    company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid())
)
WITH CHECK (
    company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid())
);

-- 1.4 Notifications & Ticket Status History: Remove permissive system inserts
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert status history" ON public.ticket_status_history;


-- ---------------------------------------------------------------------------------
-- 2. Lock Down SECURITY DEFINER Function Execution
-- ---------------------------------------------------------------------------------

DO $$ 
DECLARE
    r record;
BEGIN
    FOR r IN SELECT proname, pg_proc.oid FROM pg_proc JOIN pg_namespace n ON n.oid = pg_proc.pronamespace WHERE n.nspname = 'public' 
    LOOP
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || quote_ident(r.proname) || '(' || pg_get_function_identity_arguments(r.oid) || ') FROM PUBLIC, anon, authenticated;';
        -- Always grant to postgres and service_role
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || quote_ident(r.proname) || '(' || pg_get_function_identity_arguments(r.oid) || ') TO postgres, service_role;';
    END LOOP;
END $$;

-- Explicitly re-grant EXECUTE to authenticated ONLY for the legitimate Frontend RPCs
GRANT EXECUTE ON FUNCTION public.fn_merge_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_company_active_agents TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_plan_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id TO authenticated;


-- ---------------------------------------------------------------------------------
-- 3. Fix Mutable search_path
-- ---------------------------------------------------------------------------------

DO $$ 
DECLARE
    r record;
BEGIN
    FOR r IN SELECT proname, pg_proc.oid FROM pg_proc JOIN pg_namespace n ON n.oid = pg_proc.pronamespace WHERE n.nspname = 'public' 
    LOOP
        EXECUTE 'ALTER FUNCTION public.' || quote_ident(r.proname) || '(' || pg_get_function_identity_arguments(r.oid) || ') SET search_path = public, pg_temp;';
    END LOOP;
END $$;


-- ---------------------------------------------------------------------------------
-- 4. Move pg_net to the extensions schema (Skipped due to extension limitation)
-- ---------------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, anon, service_role;
-- ALTER EXTENSION pg_net SET SCHEMA extensions; -- Not supported by pg_net
