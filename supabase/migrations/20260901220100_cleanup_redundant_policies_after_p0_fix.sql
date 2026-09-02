-- =============================================================================
-- Migration: 20260901220100_cleanup_redundant_policies_after_p0_fix.sql
--
-- Descrição:
-- Limpeza das policies redundantes que coexistiam com as novas policies
-- unificadas criadas em 20260901220000. Aplicada diretamente no banco via
-- MCP após verificação de estado real em produção.
-- =============================================================================

-- monitored_endpoints: remover as 4 policies antigas (SELECT duplicado + 3
-- operações de escrita que já tinham equivalentes em add_role_check_monitoring_rls)
DROP POLICY IF EXISTS "Users can view company endpoints" ON public.monitored_endpoints;
DROP POLICY IF EXISTS "Users can insert their company endpoints" ON public.monitored_endpoints;
DROP POLICY IF EXISTS "Users can update their company endpoints" ON public.monitored_endpoints;
DROP POLICY IF EXISTS "Users can delete their company endpoints" ON public.monitored_endpoints;

-- knowledge_base_articles: remover policies por role individual agora cobertas
-- pela policy unificada "Equipe interna gerencia artigos da base de conhecimento"
DROP POLICY IF EXISTS "Admins can manage company kb_articles" ON public.knowledge_base_articles;
DROP POLICY IF EXISTS "Master admins can manage all kb_articles" ON public.knowledge_base_articles;
DROP POLICY IF EXISTS "Developers can manage all kb_articles" ON public.knowledge_base_articles;
