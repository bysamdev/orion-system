-- Remove validate_category_parent, sobra de um recurso que não existe mais.
--
-- Era função de gatilho para impedir que uma categoria fosse pai de si mesma,
-- mas a tabela de categorias foi removida: hoje as categorias de chamado são
-- uma lista fixa (constraint tickets_category_valid + src/lib/categoriasDeChamado.ts).
--
-- Conferido antes de remover: nenhum gatilho usa a função, nada depende dela
-- (pg_depend), nenhuma chamada em pg_stat_statements, nenhuma referência no
-- código, no servidor de monitoramento ou nas Edge Functions.

DROP FUNCTION IF EXISTS public.validate_category_parent();
