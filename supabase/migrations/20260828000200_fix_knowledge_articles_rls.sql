-- =================================================================================
-- Migration: 20260828000200_fix_knowledge_articles_rls.sql
-- Descrição: public.knowledge_articles (tabela global de KB, sem
-- company_id -- não confundir com knowledge_base_articles, que é
-- multi-tenant e já está corretamente escopada) tinha:
--   CREATE POLICY "Authenticated users can manage articles"
--     ON public.knowledge_articles FOR ALL TO authenticated USING (true);
-- Qualquer usuário autenticado, inclusive customer, podia criar/editar/
-- apagar qualquer artigo. A tabela não existe hoje em produção (não há
-- exposição ativa), mas se esta migration for reaplicada em qualquer
-- ambiente novo, o buraco volta -- corrigindo a fonte agora.
-- =================================================================================

DROP POLICY IF EXISTS "Authenticated users can manage articles" ON public.knowledge_articles;

CREATE POLICY "Staff can manage knowledge_articles"
  ON public.knowledge_articles
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'technician'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'technician'::app_role)
  );
