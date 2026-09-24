-- O mesmo navegador pode ter sido inscrito por outra conta (logout e login
-- com outro usuário). O endpoint é único e a RLS não deixa apagar a linha de
-- outra pessoa, então o INSERT direto falharia. Esta função grava sempre em
-- nome de quem está logado e "toma" o endpoint: quem usa o navegador agora é
-- quem recebe os avisos dele.

CREATE OR REPLACE FUNCTION public.registrar_inscricao_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint !~ '^https://' OR length(p_endpoint) > 1000
     OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = '' THEN
    RAISE EXCEPTION 'Inscrição de push inválida' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_inscricoes (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_inscricao_push(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_inscricao_push(text, text, text, text) TO authenticated;
