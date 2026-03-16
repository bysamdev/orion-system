-- Create api_keys table for machine monitoring
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    key_value TEXT NOT NULL UNIQUE,
    label TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company API keys" 
    ON public.api_keys FOR SELECT 
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage company API keys" 
    ON public.api_keys FOR ALL 
    USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) 
        AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'developer')
    );

-- Function to generate a random API key string
CREATE OR REPLACE FUNCTION generate_api_key() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := 'orion_';
    i INTEGER;
BEGIN
    FOR i IN 1..32 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create an API key for new companies/admins if needed (simplified for now)
-- For now, we will handle creation in the UI or via a seed.
