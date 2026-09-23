-- Base de conhecimento passa a usar as mesmas categorias dos chamados.
--
-- knowledge_base_articles.category_id apontava para a tabela categories, que
-- foi removida do banco: a lista de categorias do editor vinha vazia e o
-- admin não conseguia salvar artigo. Decisão de 23/09/2026 (card no Notion):
-- usar a lista fixa dos chamados (constraint tickets_category_valid,
-- src/lib/categoriasDeChamado.ts), uma lista só para os dois.
--
-- Aqui só entra a coluna nova. A category_id sai numa migration seguinte,
-- depois que o frontend novo estiver no ar, para a tela antiga não quebrar
-- durante o deploy.

ALTER TABLE public.knowledge_base_articles
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros';

ALTER TABLE public.knowledge_base_articles
  DROP CONSTRAINT IF EXISTS knowledge_base_articles_category_valid;
ALTER TABLE public.knowledge_base_articles
  ADD CONSTRAINT knowledge_base_articles_category_valid
  CHECK (category = ANY (ARRAY['erp', 'email', 'hardware', 'software', 'rede', 'outros', 'criacao_usuario', 'impressora', 'infraestrutura']));

-- Os três artigos existentes, pelo assunto do título.
UPDATE public.knowledge_base_articles SET category = 'software'
 WHERE title = 'Como resolver problemas comuns no Excel';
UPDATE public.knowledge_base_articles SET category = 'impressora'
 WHERE title = 'Configurando impressora de rede';
UPDATE public.knowledge_base_articles SET category = 'erp'
 WHERE title = 'Resetando senha do ERP';
