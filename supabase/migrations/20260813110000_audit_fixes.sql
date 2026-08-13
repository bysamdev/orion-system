-- Migration: 20260813110000_audit_fixes.sql
-- Fixes for Phase 1, 2, 3 migrations based on audit

-- 1. Fix fn_merge_tickets: Remove SECURITY DEFINER so it runs as invoker and respects RLS.
-- Also add basic null checks.
CREATE OR REPLACE FUNCTION public.fn_merge_tickets(primary_id UUID, duplicate_ids UUID[])
RETURNS VOID AS $$
DECLARE
    dup_id UUID;
    merged_by UUID;
BEGIN
    merged_by := auth.uid();
    
    IF duplicate_ids IS NULL OR array_length(duplicate_ids, 1) = 0 THEN
        RETURN;
    END IF;

    -- Optional: Prevent primary_id from being in duplicate_ids
    IF primary_id = ANY(duplicate_ids) THEN
        RAISE EXCEPTION 'Primary ticket cannot be in duplicate list';
    END IF;
    
    FOREACH dup_id IN ARRAY duplicate_ids
    LOOP
        -- Transfer updates
        UPDATE public.ticket_updates SET ticket_id = primary_id WHERE ticket_id = dup_id;
        
        -- Transfer attachments
        UPDATE public.ticket_attachments SET ticket_id = primary_id WHERE ticket_id = dup_id;
        
        -- Add audit note to primary ticket
        INSERT INTO public.ticket_updates (ticket_id, user_id, update_type, content, created_at)
        VALUES (
            primary_id, 
            merged_by, 
            'system', 
            'Ticket ' || dup_id || ' foi mesclado a este ticket.', 
            NOW()
        );
        
        -- Add audit note to duplicate ticket and close it
        UPDATE public.tickets SET status = 'closed' WHERE id = dup_id;
        
        INSERT INTO public.ticket_updates (ticket_id, user_id, update_type, content, created_at)
        VALUES (
            dup_id, 
            merged_by, 
            'system', 
            'Este ticket foi mesclado ao ticket ' || primary_id || ' e encerrado.', 
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Fix rmm_remediation_logs Foreign Key (ON DELETE CASCADE)
ALTER TABLE public.rmm_remediation_logs 
    DROP CONSTRAINT IF EXISTS rmm_remediation_logs_rule_id_fkey;

ALTER TABLE public.rmm_remediation_logs 
    ADD CONSTRAINT rmm_remediation_logs_rule_id_fkey 
    FOREIGN KEY (rule_id) 
    REFERENCES public.rmm_remediation_rules(id) 
    ON DELETE CASCADE;

-- 3. Fix asset_relationships RLS Policies
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users can view asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can insert asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can update asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can delete asset relationships" ON public.asset_relationships;

-- Recreate policies leveraging the related asset's RLS
CREATE POLICY "Users can view asset relationships" ON public.asset_relationships
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    );

CREATE POLICY "Users can insert asset relationships" ON public.asset_relationships
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    );

CREATE POLICY "Users can update asset relationships" ON public.asset_relationships
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    );

CREATE POLICY "Users can delete asset relationships" ON public.asset_relationships
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    );
