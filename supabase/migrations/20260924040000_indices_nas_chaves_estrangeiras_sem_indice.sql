-- Advisor do Supabase (unindexed_foreign_keys): duas chaves estrangeiras sem
-- índice. Sem ele, apagar ou alterar um profile obriga o banco a varrer a
-- tabela inteira para conferir a referência.

CREATE INDEX IF NOT EXISTS idx_configuracoes_sistema_updated_by
  ON public.configuracoes_sistema (updated_by);

CREATE INDEX IF NOT EXISTS idx_routing_rules_created_by
  ON public.routing_rules (created_by);
