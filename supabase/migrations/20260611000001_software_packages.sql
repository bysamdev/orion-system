-- ============================================================
-- ORION SYSTEM: Software Packages (Patch Management)
-- Table for scripts and installers deployed via Orion Agent.
-- Per brainstorming DEC-02: SHA-256 hash required; MFA enforced
-- at the application layer (admin/developer roles only).
--
-- FIX: roles are stored in public.user_roles, NOT in profiles.role
-- ============================================================

CREATE TABLE IF NOT EXISTS public.software_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('powershell', 'batch', 'installer')),
  -- Path in Supabase Storage (orion-packages bucket)
  file_path       TEXT,
  -- SHA-256 hex digest of the file — agent validates before execution
  sha256_hash     TEXT NOT NULL,
  -- Deployment stats
  deploy_count    INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_software_packages_company
  ON public.software_packages (company_id, created_at DESC);

-- RLS: only admins and developers can manage packages
ALTER TABLE public.software_packages ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user has admin or developer role
-- Roles are stored in user_roles table, NOT in profiles
CREATE POLICY "Admins and devs can manage packages"
  ON public.software_packages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
    AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND company_id = software_packages.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
    AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND company_id = software_packages.company_id
    )
  );

-- Deployments log: links a package dispatch to a machine
CREATE TABLE IF NOT EXISTS public.package_deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID REFERENCES public.software_packages(id) ON DELETE CASCADE NOT NULL,
  machine_id      UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  -- Reuses machine_commands mechanism: command_id created when dispatched
  command_id      UUID REFERENCES public.machine_commands(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
  dispatched_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_package_deployments_package
  ON public.package_deployments (package_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_deployments_machine
  ON public.package_deployments (machine_id, dispatched_at DESC);

ALTER TABLE public.package_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can view deployments"
  ON public.package_deployments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Admins and devs can insert deployments"
  ON public.package_deployments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
  );
