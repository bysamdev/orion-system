-- =================================================================================
-- Migration: Performance Optimization
-- Resolves: unindexed_foreign_keys, auth_rls_initplan
-- =================================================================================

-- ---------------------------------------------------------------------------------
-- 1. Create Missing Indexes for Foreign Keys
-- ---------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS monitored_endpoints_company_id_idx ON public.monitored_endpoints (company_id);
CREATE INDEX IF NOT EXISTS network_links_company_id_idx ON public.network_links (company_id);
CREATE INDEX IF NOT EXISTS rmm_remediation_logs_rule_id_idx ON public.rmm_remediation_logs (rule_id);
CREATE INDEX IF NOT EXISTS ticket_assets_asset_id_idx ON public.ticket_assets (asset_id);
CREATE INDEX IF NOT EXISTS tickets_asset_id_idx ON public.tickets (asset_id);


-- ---------------------------------------------------------------------------------
-- 2. Optimize RLS Policies (auth.uid() -> (select auth.uid()))
-- ---------------------------------------------------------------------------------

DO $$ 
DECLARE
    r record;
    new_qual text;
    new_with_check text;
    sql_cmd text;
BEGIN
    FOR r IN 
        SELECT 
            n.nspname AS schemaname,
            c.relname AS tablename,
            pol.polname AS policyname,
            pg_get_expr(pol.polqual, pol.polrelid) AS qual,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%' OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%')
    LOOP
        new_qual := replace(r.qual, 'auth.uid()', '(select auth.uid())');
        new_with_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
        
        -- To avoid multiple (select (select ...))
        new_qual := replace(new_qual, '(select (select auth.uid()))', '(select auth.uid())');
        new_with_check := replace(new_with_check, '(select (select auth.uid()))', '(select auth.uid())');
        
        sql_cmd := 'ALTER POLICY ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
        
        IF new_qual IS NOT NULL THEN
            sql_cmd := sql_cmd || ' USING (' || new_qual || ')';
        END IF;
        
        IF new_with_check IS NOT NULL THEN
            sql_cmd := sql_cmd || ' WITH CHECK (' || new_with_check || ')';
        END IF;
        
        EXECUTE sql_cmd;
    END LOOP;
END $$;
