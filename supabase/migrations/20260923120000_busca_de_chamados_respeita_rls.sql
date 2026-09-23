-- ORN-SEC-17: search_tickets rodava como SECURITY DEFINER (ignora RLS) e
-- filtrava só por empresa, sem olhar o papel. Um cliente buscava e lia título
-- e descrição de chamados de colegas da mesma empresa, que a RLS de tickets
-- não mostra a ele.
--
-- Agora a função roda com os direitos de quem chama: a busca devolve
-- exatamente os chamados que a pessoa já enxerga pela RLS.

CREATE OR REPLACE FUNCTION public.search_tickets(search_query text)
RETURNS TABLE(id uuid, ticket_number integer, title text, description text, status text, priority text, created_at timestamp with time zone, rank real)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF search_query IS NULL OR length(trim(search_query)) = 0 THEN
    RETURN;
  END IF;

  IF length(search_query) > 500 THEN
    RAISE EXCEPTION 'Consulta de busca muito longa (máximo 500 caracteres)';
  END IF;

  RETURN QUERY
  SELECT t.id, t.ticket_number, t.title, t.description, t.status, t.priority, t.created_at,
         ts_rank(t.search_vector, websearch_to_tsquery('portuguese', search_query)) AS rank
    FROM public.tickets t
   WHERE t.search_vector @@ websearch_to_tsquery('portuguese', search_query)
   ORDER BY rank DESC, t.created_at DESC
   LIMIT 100;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_tickets(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_tickets(text) TO authenticated;
