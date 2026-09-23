-- ORN-SEC-20: o gatilho forçava author_id, mas mantinha o texto "author"
-- enviado pelo cliente. Um cliente podia postar como "Suporte Orion". A
-- policy de INSERT também aceitava qualquer type e is_internal = true vindo
-- do dono do chamado.
--
-- Com sessão, o nome passa a vir sempre do perfil. Quem não é da equipe
-- interna só grava comentário ou mudança de status, e nunca nota interna.
-- Sem sessão (cron, service_role, backend Go) segue como antes.

CREATE OR REPLACE FUNCTION public.set_ticket_update_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_autor_automacao text := current_setting('orion.autor_automacao', true);
  v_uid uuid := auth.uid();
BEGIN
  IF v_autor_automacao IS NOT NULL AND v_autor_automacao <> '' THEN
    NEW.author_id := v_autor_automacao::uuid;
    NEW.author := 'Resposta automática';
    RETURN NEW;
  END IF;

  NEW.author_id := v_uid;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.author := COALESCE((SELECT full_name FROM public.profiles WHERE id = v_uid), v_uid::text);

  IF NOT public.is_equipe_interna(v_uid) THEN
    IF NEW.type NOT IN ('comment', 'status_change') THEN
      RAISE EXCEPTION 'Tipo de atualização não permitido' USING ERRCODE = '42501';
    END IF;
    NEW.is_internal := false;
  END IF;

  RETURN NEW;
END;
$$;
