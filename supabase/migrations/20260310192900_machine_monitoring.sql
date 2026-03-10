-- ============================================================
-- Migration: Machine Monitoring Tables
-- Created at: 2026-03-10 19:29:00 UTC
-- Description: Cria as tabelas de grupos de máquinas, máquinas,
--              métricas, hardware e alertas para o sistema Orion.
-- ============================================================

-- ============================================================
-- 1. machine_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machine_groups (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL,
  description     TEXT,
  client_contact  TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. machines
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machines (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID          REFERENCES public.machine_groups (id) ON DELETE SET NULL,
  hostname        TEXT          NOT NULL,
  ip_address      TEXT,
  os              TEXT,
  os_version      TEXT,
  status          TEXT          NOT NULL DEFAULT 'offline',
  last_seen       TIMESTAMPTZ,
  agent_version   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. machine_metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machine_metrics (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  cpu_usage    FLOAT,
  ram_total    BIGINT,
  ram_used     BIGINT,
  disk_total   BIGINT,
  disk_used    BIGINT,
  uptime       BIGINT,
  collected_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. machine_hardware
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machine_hardware (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  cpu_model   TEXT,
  ram_slots   JSONB,
  disks       JSONB,
  gpu         TEXT,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. machine_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machine_alerts (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  type        TEXT,
  severity    TEXT,
  message     TEXT,
  resolved    BOOLEAN       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Índices de performance
-- ============================================================

-- machines
CREATE INDEX IF NOT EXISTS idx_machines_group_id
  ON public.machines (group_id);

-- machine_metrics
CREATE INDEX IF NOT EXISTS idx_machine_metrics_machine_id
  ON public.machine_metrics (machine_id);

CREATE INDEX IF NOT EXISTS idx_machine_metrics_collected_at
  ON public.machine_metrics (collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_machine_metrics_machine_collected
  ON public.machine_metrics (machine_id, collected_at DESC);

-- machine_hardware
CREATE INDEX IF NOT EXISTS idx_machine_hardware_machine_id
  ON public.machine_hardware (machine_id);

-- machine_alerts
CREATE INDEX IF NOT EXISTS idx_machine_alerts_machine_id
  ON public.machine_alerts (machine_id);

CREATE INDEX IF NOT EXISTS idx_machine_alerts_resolved
  ON public.machine_alerts (machine_id, resolved);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.machine_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_alerts   ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- Políticas: machine_groups
-- -----------------------------------------------
CREATE POLICY "Authenticated users can view machine_groups"
  ON public.machine_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machine_groups"
  ON public.machine_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machine_groups"
  ON public.machine_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete machine_groups"
  ON public.machine_groups
  FOR DELETE
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Políticas: machines
-- -----------------------------------------------
CREATE POLICY "Authenticated users can view machines"
  ON public.machines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machines"
  ON public.machines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machines"
  ON public.machines
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete machines"
  ON public.machines
  FOR DELETE
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Políticas: machine_metrics
-- -----------------------------------------------
CREATE POLICY "Authenticated users can view machine_metrics"
  ON public.machine_metrics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machine_metrics"
  ON public.machine_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machine_metrics"
  ON public.machine_metrics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete machine_metrics"
  ON public.machine_metrics
  FOR DELETE
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Políticas: machine_hardware
-- -----------------------------------------------
CREATE POLICY "Authenticated users can view machine_hardware"
  ON public.machine_hardware
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machine_hardware"
  ON public.machine_hardware
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machine_hardware"
  ON public.machine_hardware
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete machine_hardware"
  ON public.machine_hardware
  FOR DELETE
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Políticas: machine_alerts
-- -----------------------------------------------
CREATE POLICY "Authenticated users can view machine_alerts"
  ON public.machine_alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machine_alerts"
  ON public.machine_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machine_alerts"
  ON public.machine_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete machine_alerts"
  ON public.machine_alerts
  FOR DELETE
  TO authenticated
  USING (true);
