-- Escopa rmm_remediation_rules e rmm_remediation_logs por empresa.
--
-- Contexto: 20260813100000_phase3_self_healing.sql criou as duas tabelas com
-- políticas globais, e nenhuma coluna company_id:
--
--   rmm_remediation_rules  FOR SELECT USING (true)
--                          FOR ALL    USING (auth.role() = 'authenticated')
--   rmm_remediation_logs   FOR INSERT WITH CHECK (true)
--                          FOR SELECT USING (auth.role() = 'authenticated')
--
-- Consequência: qualquer usuário autenticado, de qualquer empresa, lê e ESCREVE
-- regras de remediação. O campo action_payload dessas regras é executado pelo
-- agente Windows via `cmd /C` (orion-agent/service/windows.go), então escrever
-- regra é execução remota de comando atravessando a fronteira de tenant — a
-- mesma classe de falha que 20260812210000_scope_machine_commands_rls.sql
-- corrigiu em machine_commands, reintroduzida aqui.
--
-- Esta migration adiciona company_id nas duas tabelas e substitui as políticas
-- globais pelo mesmo padrão já usado em machine_commands.
--
-- company_id é NULLABLE de propósito: as tabelas podem já ter linhas sem
-- empresa e um NOT NULL quebraria a migration. Linha sem empresa só é visível
-- para empresa master / developer (ver políticas abaixo), então o default é
-- fechado, não aberto.

-- ─── Colunas ────────────────────────────────────────────────────────────────

ALTER TABLE public.rmm_remediation_rules
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.rmm_remediation_logs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- alert_type: o backend reporta o tipo de alerta que disparou a remediação
-- (handler/mon_handlers.go, monitoringSelfHealEvent). A tabela de logs não
-- tinha onde guardá-lo.
ALTER TABLE public.rmm_remediation_logs
  ADD COLUMN IF NOT EXISTS alert_type TEXT;

CREATE INDEX IF NOT EXISTS idx_remediation_rules_company_id
  ON public.rmm_remediation_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_remediation_logs_company_id
  ON public.rmm_remediation_logs (company_id);

-- ─── rmm_remediation_rules ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow select on rmm_remediation_rules" ON public.rmm_remediation_rules;
DROP POLICY IF EXISTS "Allow all on rmm_remediation_rules for authenticated users" ON public.rmm_remediation_rules;

DROP POLICY IF EXISTS "Users can view company remediation rules" ON public.rmm_remediation_rules;
DROP POLICY IF EXISTS "Admins and techs can insert company remediation rules" ON public.rmm_remediation_rules;
DROP POLICY IF EXISTS "Admins and techs can update company remediation rules" ON public.rmm_remediation_rules;
DROP POLICY IF EXISTS "Admins can delete company remediation rules" ON public.rmm_remediation_rules;

ALTER TABLE public.rmm_remediation_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário da empresa vê as regras dela.
CREATE POLICY "Users can view company remediation rules"
  ON public.rmm_remediation_rules FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- INSERT: criar regra define comando que o agente vai EXECUTAR — só admin e
-- técnico da empresa dona (mais empresa master e developer).
CREATE POLICY "Admins and techs can insert company remediation rules"
  ON public.rmm_remediation_rules FOR INSERT TO authenticated
  WITH CHECK (
    (
      company_id = get_user_company_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'technician'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- UPDATE: mesma regra do INSERT. WITH CHECK repete a condição para impedir que
-- uma linha seja "movida" para outra empresa durante o update.
CREATE POLICY "Admins and techs can update company remediation rules"
  ON public.rmm_remediation_rules FOR UPDATE TO authenticated
  USING (
    (
      company_id = get_user_company_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'technician'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    (
      company_id = get_user_company_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'technician'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- DELETE: só admin da empresa.
CREATE POLICY "Admins can delete company remediation rules"
  ON public.rmm_remediation_rules FOR DELETE TO authenticated
  USING (
    (
      company_id = get_user_company_id(auth.uid())
      AND has_role(auth.uid(), 'admin'::app_role)
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- ─── rmm_remediation_logs ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow insert on rmm_remediation_logs" ON public.rmm_remediation_logs;
DROP POLICY IF EXISTS "Allow select on rmm_remediation_logs for authenticated users" ON public.rmm_remediation_logs;

DROP POLICY IF EXISTS "Users can view company remediation logs" ON public.rmm_remediation_logs;

ALTER TABLE public.rmm_remediation_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: só a própria empresa (mais master/developer).
CREATE POLICY "Users can view company remediation logs"
  ON public.rmm_remediation_logs FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- Sem política de INSERT/UPDATE/DELETE para `authenticated`: quem grava log de
-- autocura é o backend (POST /api/monitoring/self-heal-event), pela conexão
-- privilegiada, que não passa por RLS. A política aberta anterior
-- (WITH CHECK (true)) permitia que qualquer usuário forjasse histórico de
-- remediação de qualquer empresa.
