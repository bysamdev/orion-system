-- Migration: Network Links and Device Inventory Column additions
-- File: supabase/migrations/20260811000005_network_links_and_inventory.sql

-- 1. Create public.network_links table
CREATE TABLE IF NOT EXISTS public.network_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    link_type text NOT NULL DEFAULT 'starlink',
    ip_or_hostname text DEFAULT '',
    check_interval_seconds integer DEFAULT 300,
    status text DEFAULT 'pending',
    last_ping_ms integer,
    last_checked_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Add RLS policies for network_links
ALTER TABLE public.network_links ENABLE ROW LEVEL SECURITY;

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

-- 3. Add inventory columns to machines table if missing
ALTER TABLE public.machines
    ADD COLUMN IF NOT EXISTS mac_address text,
    ADD COLUMN IF NOT EXISTS logged_in_user text,
    ADD COLUMN IF NOT EXISTS local_ip text,
    ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'desktop';
