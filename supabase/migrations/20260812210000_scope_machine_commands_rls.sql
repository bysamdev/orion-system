-- Escopa machine_commands por empresa (pentest Strix vuln-0004).
--
-- Contexto: 20260321000300_master_monitoring_repair.sql criou duas políticas
-- globais nesta tabela:
--
--   "Global select for commands"  FOR SELECT TO authenticated USING (true)
--   "Global manage for commands"  FOR ALL    TO authenticated USING (true)
--
-- A migration de endurecimento 20260614000001_enable_rls_machines.sql escopou
-- machines, machine_groups, machine_hardware e machine_metrics por empresa,
-- mas não tocou em machine_commands — as duas políticas globais seguiram ativas.
--
-- Consequência: qualquer usuário autenticado inseria via PostgREST uma linha
-- com o machine_id de OUTRA empresa; o agente Windows da vítima faz poll a cada
-- 30s e executa o conteúdo via `cmd /C` (orion-agent/service/windows.go).
-- Isso é execução remota de comando atravessando a fronteira de tenant.
--
-- machine_commands não tem coluna company_id, então o vínculo é feito pela
-- máquina referenciada, espelhando o padrão já usado para machines.
--
-- Perfis: o único ponto que enfileira comando pelo frontend é useDeployPackage
-- (src/hooks/usePatchManagement.ts), acessível só pela tela PatchManagement,
-- que já exige admin/developer/technician. As políticas abaixo cobrem esse
-- fluxo sem alteração — nenhum caminho legítimo existente é bloqueado.

-- Idempotência: derruba as globais e também as novas, caso rode duas vezes.
DROP POLICY IF EXISTS "Global select for commands" ON public.machine_commands;
DROP POLICY IF EXISTS "Global manage for commands" ON public.machine_commands;

DROP POLICY IF EXISTS "Users can view company machine commands" ON public.machine_commands;
DROP POLICY IF EXISTS "Admins and techs can insert company machine commands" ON public.machine_commands;
DROP POLICY IF EXISTS "Admins and techs can update company machine commands" ON public.machine_commands;
DROP POLICY IF EXISTS "Admins can delete company machine commands" ON public.machine_commands;

ALTER TABLE public.machine_commands ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário da empresa vê os comandos das máquinas dela.
CREATE POLICY "Users can view company machine commands"
  ON public.machine_commands FOR SELECT TO authenticated
  USING (
    machine_id IN (
      SELECT id FROM public.machines
      WHERE company_id = get_user_company_id(auth.uid())
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- INSERT: enfileirar comando é ação privilegiada — só admin/técnico da empresa
-- dona da máquina (mais empresa master e developer).
CREATE POLICY "Admins and techs can insert company machine commands"
  ON public.machine_commands FOR INSERT TO authenticated
  WITH CHECK (
    (
      machine_id IN (
        SELECT id FROM public.machines
        WHERE company_id = get_user_company_id(auth.uid())
      )
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'technician'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- UPDATE: mesma regra do INSERT. O agente NÃO passa por aqui — ele responde
-- via POST /api/monitoring/commands/respond, que usa a conexão privilegiada do
-- backend e não é submetido a RLS.
CREATE POLICY "Admins and techs can update company machine commands"
  ON public.machine_commands FOR UPDATE TO authenticated
  USING (
    (
      machine_id IN (
        SELECT id FROM public.machines
        WHERE company_id = get_user_company_id(auth.uid())
      )
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'technician'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- DELETE: só admin da empresa.
CREATE POLICY "Admins can delete company machine commands"
  ON public.machine_commands FOR DELETE TO authenticated
  USING (
    (
      machine_id IN (
        SELECT id FROM public.machines
        WHERE company_id = get_user_company_id(auth.uid())
      )
      AND has_role(auth.uid(), 'admin'::app_role)
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );
