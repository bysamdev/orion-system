-- Table for Knowledge Base articles
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT          NOT NULL,
  slug         TEXT          NOT NULL UNIQUE,
  content      TEXT          NOT NULL, -- Markdown content
  category     TEXT          NOT NULL DEFAULT 'Geral',
  tags         TEXT[],
  is_published BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Initial articles
INSERT INTO public.knowledge_articles (title, slug, content, category)
VALUES 
('Como configurar o Orion Agent', 'configurar-orion-agent', '# Configuração do Agent\n\nPara configurar o agent, siga os passos:\n1. Baixe o executável...\n2. Instale o serviço...\n3. Verifique o dashboard.', 'Configuração'),
('Resolvendo problemas de conexão', 'problemas-conexao', '# Problemas de Conexão\n\nCaso o agent não apareça online:\n- Verifique o firewall\n- Verifique a chave de API\n- Reinicie o serviço.', 'Troubleshooting');

-- RLS
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published articles"
  ON public.knowledge_articles
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Authenticated users can manage articles"
  ON public.knowledge_articles
  FOR ALL
  TO authenticated
  USING (true);
