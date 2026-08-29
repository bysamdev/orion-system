-- =================================================================================
-- Migration: Confiança/motivo, override manual e histórico de device_type
--
-- Fase 3 do plano de escalabilidade — lacunas encontradas na auditoria vs. a
-- especificação:
--   - "permitir UNKNOWN quando confiança for insuficiente": o agente já
--     passou a reportar "unknown" em vez de presumir "desktop" sem sinal
--     nenhum (orion-agent/collector/device_type_windows.go e
--     device_type_other.go).
--   - "armazenar tipo detectado e, se possível, motivo/confiança":
--     device_type_reason.
--   - "permitir override manual pelo Orion": device_type_locked — quando
--     true, o heartbeat do agente para de sobrescrever device_type/
--     device_type_reason desta máquina.
--   - "registrar mudança de classificação": machine_device_type_history.
-- =================================================================================

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS device_type_reason text,
  ADD COLUMN IF NOT EXISTS device_type_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.machines.device_type_locked IS
  'true = classificação corrigida manualmente; o heartbeat do agente para de sobrescrever device_type/device_type_reason desta máquina.';

CREATE TABLE IF NOT EXISTS public.machine_device_type_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  UUID        NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  old_type    TEXT,
  new_type    TEXT        NOT NULL,
  reason      TEXT,
  changed_by  TEXT        NOT NULL DEFAULT 'agent' CHECK (changed_by IN ('agent', 'manual')),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_device_type_history_machine_id
  ON public.machine_device_type_history (machine_id, changed_at DESC);

ALTER TABLE public.machine_device_type_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company machine_device_type_history" ON public.machine_device_type_history FOR SELECT USING (
  machine_id IN (SELECT id FROM public.machines WHERE company_id = get_user_company_id(auth.uid()))
  OR is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machine_device_type_history" ON public.machine_device_type_history FOR INSERT WITH CHECK (
  machine_id IN (SELECT id FROM public.machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid())
  OR has_role(auth.uid(), 'developer'::app_role)
);
