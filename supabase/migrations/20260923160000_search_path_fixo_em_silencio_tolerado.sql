-- Fase 7 da auditoria: último aviso de search_path mutável do advisor de
-- segurança. A função só devolve um intervalo fixo; fixar o search_path não
-- muda o comportamento.
ALTER FUNCTION public.silencio_tolerado(text) SET search_path TO 'public', 'pg_temp';
