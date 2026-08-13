-- Fecha duas brechas deixadas pelas políticas de asset_relationships criadas em
-- 20260813110000_audit_fixes.sql.
--
-- Aquelas políticas delegam a autorização à RLS de public.assets, via
-- EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id) — a
-- subquery só enxerga o que a RLS de assets permite ao invocador, então a ideia
-- está certa. Faltaram dois pontos:
--
--   1. Só source_asset_id era validado. target_asset_id não era checado em
--      nenhuma operação, então um usuário conseguia ligar um ativo próprio a um
--      ativo de OUTRA empresa — o alvo aparece no grafo de topologia e a
--      existência do ativo alheio fica confirmada.
--
--   2. A política de UPDATE tinha USING mas não WITH CHECK. USING decide quais
--      linhas podem ser alteradas; WITH CHECK decide como elas podem ficar
--      DEPOIS. Sem WITH CHECK, uma linha legítima podia ser reapontada para um
--      ativo fora do alcance do usuário.

DROP POLICY IF EXISTS "Users can view asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can insert asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can update asset relationships" ON public.asset_relationships;
DROP POLICY IF EXISTS "Users can delete asset relationships" ON public.asset_relationships;

ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;

-- Ver a relação exige enxergar as DUAS pontas.
CREATE POLICY "Users can view asset relationships"
  ON public.asset_relationships FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = target_asset_id)
  );

CREATE POLICY "Users can insert asset relationships"
  ON public.asset_relationships FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = target_asset_id)
  );

-- WITH CHECK repete a condição para impedir que a linha seja reapontada para um
-- ativo que o usuário não enxerga.
CREATE POLICY "Users can update asset relationships"
  ON public.asset_relationships FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = target_asset_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = target_asset_id)
  );

CREATE POLICY "Users can delete asset relationships"
  ON public.asset_relationships FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = source_asset_id)
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = target_asset_id)
  );

-- NOTA (não corrigido aqui, precisa de decisão sua): a eficácia de tudo acima
-- depende da RLS de public.assets, e ela tem um furo próprio. Em
-- 20260316000000_add_cmdb_assets.sql:
--
--   CREATE POLICY "Admins and Technicians can manage assets"
--     ON public.assets FOR ALL TO authenticated
--     USING (EXISTS (SELECT 1 FROM public.profiles
--                    WHERE id = auth.uid() AND role IN ('admin','technician','developer')));
--
-- Essa política não correlaciona company_id: qualquer admin ou técnico de
-- QUALQUER empresa enxerga e gerencia os ativos de TODAS as empresas. Corrigir
-- exige decidir se 'admin' no Orion é papel por empresa ou global — a mesma
-- dúvida em aberto sobre admin-update-user/delete-user-admin.
