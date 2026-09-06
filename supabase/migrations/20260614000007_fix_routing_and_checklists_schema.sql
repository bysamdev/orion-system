-- 1. Create or fix routing_rules table
CREATE TABLE IF NOT EXISTS public.routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 1,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- In case the table already existed with the old schema, we add the new columns
ALTER TABLE public.routing_rules
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '{}'::jsonb;

-- And drop the old ones (if they exist)
ALTER TABLE public.routing_rules
  DROP COLUMN IF EXISTS condition_category,
  DROP COLUMN IF EXISTS condition_priority,
  DROP COLUMN IF EXISTS condition_company_id,
  DROP COLUMN IF EXISTS action_type,
  DROP COLUMN IF EXISTS action_target_user_id;

-- Ensure RLS is enabled and policies are created
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view routing rules of their company' AND tablename = 'routing_rules') THEN
        CREATE POLICY "Users can view routing rules of their company"
            ON public.routing_rules FOR SELECT
            USING (company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage routing rules' AND tablename = 'routing_rules') THEN
        CREATE POLICY "Admins can manage routing rules"
            ON public.routing_rules FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles 
                    WHERE user_id = auth.uid() AND role::text IN ('admin', 'developer')
                )
            );
    END IF;
END $$;


-- 2. Create or fix resolution_checklists table
CREATE TABLE IF NOT EXISTS public.resolution_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, category)
);

-- If the table existed and had the 'steps' column instead of 'items'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resolution_checklists' AND column_name = 'steps') THEN
        ALTER TABLE public.resolution_checklists RENAME COLUMN steps TO items;
    END IF;
END $$;

-- Ensure RLS is enabled and policies are created
ALTER TABLE public.resolution_checklists ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view resolution checklists of their company' AND tablename = 'resolution_checklists') THEN
        CREATE POLICY "Users can view resolution checklists of their company"
            ON public.resolution_checklists FOR SELECT
            USING (company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage resolution checklists' AND tablename = 'resolution_checklists') THEN
        CREATE POLICY "Admins can manage resolution checklists"
            ON public.resolution_checklists FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles 
                    WHERE user_id = auth.uid() AND role::text IN ('admin', 'developer')
                )
            );
    END IF;
END $$;
