-- Fix 1: Restrict departments access to technicians only (remove customer access)
DROP POLICY IF EXISTS "Users can view departments from their company" ON departments;

CREATE POLICY "Technicians can view company departments"
ON departments FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);

-- Fix 2: Add input validation to search_tickets function
CREATE OR REPLACE FUNCTION public.search_tickets(search_query text)
RETURNS TABLE(
  id uuid, 
  ticket_number integer, 
  title text, 
  description text, 
  status text, 
  priority text, 
  created_at timestamp with time zone, 
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar input nulo ou vazio
  IF search_query IS NULL OR length(trim(search_query)) = 0 THEN
    RETURN QUERY 
    SELECT 
      t.id,
      t.ticket_number,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.created_at,
      0::real as rank
    FROM tickets t
    WHERE false;
    RETURN;
  END IF;
  
  -- Limitar tamanho da query para prevenir abuse
  IF length(search_query) > 500 THEN
    RAISE EXCEPTION 'Consulta de busca muito longa (máximo 500 caracteres)';
  END IF;
  
  -- Busca com validação aplicada
  RETURN QUERY
  SELECT 
    t.id,
    t.ticket_number,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.created_at,
    ts_rank(t.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank
  FROM tickets t
  WHERE t.search_vector @@ websearch_to_tsquery('portuguese', search_query)
  ORDER BY rank DESC, t.created_at DESC
  LIMIT 100;
END;
$$;