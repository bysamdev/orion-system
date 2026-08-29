-- Envolve as chamadas de auth.uid() ainda não otimizadas em (select ...) para
-- que o Postgres avalie uma vez por statement (InitPlan) em vez de uma vez
-- por linha. Apenas 3 das 181 políticas do schema public tinham esse
-- problema de verdade (as outras 173 já usavam o padrão correto) — as 3
-- batem exatamente com o achado do linter oficial do Supabase
-- (auth_rls_initplan). Verificado mecanicamente antes de aplicar: removendo
-- o wrapper adicionado, cada expressão nova reproduz a original byte a
-- byte — nenhuma condição de acesso foi alterada, só QUANDO a função é
-- avaliada. auth.uid() é STABLE (confirmado via pg_proc.provolatile), então
-- essa transformação nunca muda o resultado, só o custo.

ALTER POLICY "Master technicians can view all status history" ON public.ticket_status_history
  USING ((has_role((select auth.uid()), 'technician'::app_role) AND is_master_company_user((select auth.uid()))));

ALTER POLICY "Master technicians can view all ticket updates" ON public.ticket_updates
  USING ((has_role((select auth.uid()), 'technician'::app_role) AND is_master_company_user((select auth.uid()))));

ALTER POLICY "select_tickets" ON public.tickets
  USING (((user_id = (select auth.uid())) OR (assigned_to_user_id = (select auth.uid())) OR ((company_id = get_user_company_id((select auth.uid()))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'technician'::app_role))) OR has_role((select auth.uid()), 'developer'::app_role) OR (is_master_company_user((select auth.uid())) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'technician'::app_role)))));
