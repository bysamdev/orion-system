-- 1. Fix search_tickets: add company/role scoping to prevent cross-tenant data leakage
CREATE OR REPLACE FUNCTION public.search_tickets(search_query text)
 RETURNS TABLE(id uuid, ticket_number integer, title text, description text, status text, priority text, created_at timestamp with time zone, rank real)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF search_query IS NULL OR length(trim(search_query)) = 0 THEN
    RETURN QUERY 
    SELECT t.id, t.ticket_number, t.title, t.description, t.status, t.priority, t.created_at, 0::real as rank
    FROM tickets t WHERE false;
    RETURN;
  END IF;
  
  IF length(search_query) > 500 THEN
    RAISE EXCEPTION 'Consulta de busca muito longa (máximo 500 caracteres)';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id, t.ticket_number, t.title, t.description, t.status, t.priority, t.created_at,
    ts_rank(t.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank
  FROM tickets t
  WHERE t.search_vector @@ websearch_to_tsquery('portuguese', search_query)
    AND (
      has_role(auth.uid(), 'developer'::app_role)
      OR is_master_company_user(auth.uid())
      OR t.company_id = get_user_company_id(auth.uid())
    )
  ORDER BY rank DESC, t.created_at DESC
  LIMIT 100;
END;
$$;

-- 2. Fix invite_tokens: remove public SELECT policy exposing tokens to anon users
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.invite_tokens;