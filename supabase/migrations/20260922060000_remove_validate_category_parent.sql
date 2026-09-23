-- Remove validate_category_parent, sobra de um recurso que não existe mais.
--
-- Era função de gatilho para impedir que uma categoria fosse pai de si mesma,
-- mas a tabela de categorias foi removida: hoje as categorias de chamado são
-- uma lista fixa (constraint tickets_category_valid + src/lib/categoriasDeChamado.ts).
--
-- Conferido antes de remover: nenhum gatilho usa a função, nada depende dela
-- (pg_depend), nenhuma chamada em pg_stat_statements, nenhuma referência no
-- código, no servidor de monitoramento ou nas Edge Functions.

-- Em produção a tabela categories já não existe (foi removida fora das
-- migrations), mas no replay do zero da CI ela ainda existe com o gatilho
-- trg_validate_category_parent, que prende a função. Sem tabela, nada a fazer.
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_validate_category_parent ON public.categories;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.validate_category_parent();
