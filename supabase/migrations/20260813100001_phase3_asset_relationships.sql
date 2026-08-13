-- Migration: Phase 3 Asset Relationships
CREATE TABLE IF NOT EXISTS public.asset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    target_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    port_source TEXT,
    port_target TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming similar to assets, authenticated users can view/manage)
CREATE POLICY "Users can view asset relationships" ON public.asset_relationships
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert asset relationships" ON public.asset_relationships
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update asset relationships" ON public.asset_relationships
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete asset relationships" ON public.asset_relationships
    FOR DELETE TO authenticated USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_asset_relationships_source ON public.asset_relationships(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_relationships_target ON public.asset_relationships(target_asset_id);
