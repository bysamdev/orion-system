-- Migration: Complete Network Links Table and RLS
-- File: supabase/migrations/20260812000000_network_links_complete.sql

CREATE TABLE IF NOT EXISTS public.network_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    link_type text NOT NULL DEFAULT 'starlink',
    type text,
    ip_or_hostname text NOT NULL DEFAULT '',
    ip_or_host text,
    check_interval_seconds integer DEFAULT 300,
    status text DEFAULT 'pending',
    last_ping_ms integer,
    latency_ms integer,
    last_checked_at timestamptz,
    last_check timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure alias columns exist if table was previously created without them
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS link_type text DEFAULT 'starlink';
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS ip_or_hostname text;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS ip_or_host text;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS check_interval_seconds integer DEFAULT 300;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS last_ping_ms integer;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS last_check timestamptz;
ALTER TABLE public.network_links ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Enable RLS
ALTER TABLE public.network_links ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DROP POLICY IF EXISTS "Authenticated users can select network_links" ON public.network_links;
CREATE POLICY "Authenticated users can select network_links"
    ON public.network_links FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert network_links" ON public.network_links;
CREATE POLICY "Authenticated users can insert network_links"
    ON public.network_links FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update network_links" ON public.network_links;
CREATE POLICY "Authenticated users can update network_links"
    ON public.network_links FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete network_links" ON public.network_links;
CREATE POLICY "Authenticated users can delete network_links"
    ON public.network_links FOR DELETE
    TO authenticated
    USING (true);
