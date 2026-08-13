-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding column to knowledge_base_articles
ALTER TABLE public.knowledge_base_articles 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index for fast nearest-neighbor search
CREATE INDEX IF NOT EXISTS knowledge_base_articles_embedding_hnsw_idx 
ON public.knowledge_base_articles 
USING hnsw (embedding vector_cosine_ops);

-- Create a function to match knowledge base articles based on embedding similarity
CREATE OR REPLACE FUNCTION public.match_kb_articles(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_company_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kba.id,
    kba.title,
    kba.content,
    kba.category,
    1 - (kba.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base_articles kba
  WHERE 
    kba.company_id = p_company_id
    AND 1 - (kba.embedding <=> query_embedding) > match_threshold
  ORDER BY kba.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
