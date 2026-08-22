-- =================================================================================
-- Migration: 20260822100000_security_audit_remediations.sql
-- Descrição: Correção consolidada de vulnerabilidades de RLS, Multi-Tenancy e AuthZ
-- =================================================================================

-- 1. invite_tokens: Fechar acesso público e revogar permissões anônimas
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Service role can delete tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Admins and developers can view company invite tokens" ON public.invite_tokens;
REVOKE ALL ON public.invite_tokens FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_tokens TO authenticated, service_role;

CREATE POLICY "Admins and developers can view company invite tokens"
ON public.invite_tokens FOR SELECT TO authenticated
USING (
  is_master_company_user(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)
);

-- 2. knowledge_articles: Restringir gerenciamento para developer e master
DROP POLICY IF EXISTS "Authenticated users can manage articles" ON public.knowledge_articles;
DROP POLICY IF EXISTS "Only developers and master admins can manage knowledge_articles" ON public.knowledge_articles;

CREATE POLICY "Only developers and master admins can manage knowledge_articles"
  ON public.knowledge_articles FOR ALL TO authenticated
  USING (is_master_company_user(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (is_master_company_user(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role));

-- 3. assets & ticket_assets: Isolamento estrito por tenant
DROP POLICY IF EXISTS "Users can view assets of their company" ON public.assets;
DROP POLICY IF EXISTS "Admins and Technicians can manage assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view company assets" ON public.assets;
DROP POLICY IF EXISTS "Admins and technicians can manage company assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view links for their tickets" ON public.ticket_assets;
DROP POLICY IF EXISTS "Admins and Technicians can link assets to tickets" ON public.ticket_assets;
DROP POLICY IF EXISTS "Users can view ticket asset links" ON public.ticket_assets;
DROP POLICY IF EXISTS "Admins and technicians can manage ticket asset links" ON public.ticket_assets;

CREATE POLICY "Users can view company assets"
  ON public.assets FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "Admins and technicians can manage company assets"
  ON public.assets FOR ALL TO authenticated
  USING (
    (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "Users can view ticket asset links"
  ON public.ticket_assets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_assets.ticket_id
        AND (
          t.user_id = auth.uid()
          OR t.company_id = get_user_company_id(auth.uid())
          OR is_master_company_user(auth.uid())
          OR has_role(auth.uid(), 'developer'::app_role)
        )
    )
  );

CREATE POLICY "Admins and technicians can manage ticket asset links"
  ON public.ticket_assets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_assets.ticket_id
        AND (
          (t.company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
          OR is_master_company_user(auth.uid())
          OR has_role(auth.uid(), 'developer'::app_role)
        )
    )
  );

-- 4. package_deployments: Escopar por tenant
DROP POLICY IF EXISTS "Admins and devs can view deployments" ON public.package_deployments;
DROP POLICY IF EXISTS "Admins and devs can insert deployments" ON public.package_deployments;
DROP POLICY IF EXISTS "Admins and techs can view company package deployments" ON public.package_deployments;
DROP POLICY IF EXISTS "Admins and techs can insert company package deployments" ON public.package_deployments;

CREATE POLICY "Admins and techs can view company package deployments"
  ON public.package_deployments FOR SELECT TO authenticated
  USING (
    is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
    OR (
      EXISTS (
        SELECT 1 FROM public.machines m
        WHERE m.id = package_deployments.machine_id
          AND m.company_id = get_user_company_id(auth.uid())
      )
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
    )
  );

CREATE POLICY "Admins and techs can insert company package deployments"
  ON public.package_deployments FOR INSERT TO authenticated
  WITH CHECK (
    is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
    OR (
      EXISTS (
        SELECT 1 FROM public.machines m
        WHERE m.id = package_deployments.machine_id
          AND m.company_id = get_user_company_id(auth.uid())
      )
      AND EXISTS (
        SELECT 1 FROM public.software_packages sp
        WHERE sp.id = package_deployments.package_id
          AND sp.company_id = get_user_company_id(auth.uid())
      )
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
    )
  );

-- 5. routing_rules, resolution_checklists & escalation_settings
DROP POLICY IF EXISTS "Admins can manage routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Admins can manage resolution checklists" ON public.resolution_checklists;
DROP POLICY IF EXISTS "Admins can manage escalation settings" ON public.escalation_settings;
DROP POLICY IF EXISTS "Admins can manage company routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Admins can manage company resolution checklists" ON public.resolution_checklists;
DROP POLICY IF EXISTS "Admins can manage company escalation settings" ON public.escalation_settings;

CREATE POLICY "Admins can manage company routing rules"
  ON public.routing_rules FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "Admins can manage company resolution checklists"
  ON public.resolution_checklists FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "Admins can manage company escalation settings"
  ON public.escalation_settings FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- 6. ticket_ratings
DROP POLICY IF EXISTS "Users can rate their own tickets" ON public.ticket_ratings;
DROP POLICY IF EXISTS "Users can see their own ratings" ON public.ticket_ratings;
DROP POLICY IF EXISTS "Customers can rate only their own tickets" ON public.ticket_ratings;
DROP POLICY IF EXISTS "Users and company staff can view ratings" ON public.ticket_ratings;

CREATE POLICY "Customers can rate only their own tickets"
  ON public.ticket_ratings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_ratings.ticket_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users and company staff can view ratings"
  ON public.ticket_ratings FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_ratings.ticket_id
          AND t.company_id = get_user_company_id(auth.uid())
      )
      AND (
        has_role(auth.uid(), 'technician'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
      )
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

-- 7. automation_logs & audit_log
DROP POLICY IF EXISTS "System can insert automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Admins and devs can view automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Admins and techs can view company automation logs" ON public.automation_logs;

CREATE POLICY "Admins and techs can view company automation logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = automation_logs.ticket_id
        AND t.company_id = get_user_company_id(auth.uid())
    )
    OR is_master_company_user(auth.uid())
    OR has_role(auth.uid(), 'developer'::app_role)
  );

DROP POLICY IF EXISTS "Admins can view audit logs in their company" ON public.audit_log;
CREATE POLICY "Admins can view audit logs in their company" ON public.audit_log
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND changed_by IN (SELECT id FROM profiles WHERE company_id = get_user_company_id(auth.uid()))
  );

-- 8. is_master_company_user: Coluna de controle explícito
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;

UPDATE public.companies 
SET is_master = true 
WHERE name IN ('Orion System', 'iBReady', 'bysamdev', 'Bysamdev Sistemas');

CREATE OR REPLACE FUNCTION public.is_master_company_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id 
      AND (c.is_master = true OR ur.role = 'developer'::app_role)
  );
$$;
