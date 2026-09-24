-- Limite de acessos por usuário (card do Notion, decisão de 23/09/2026):
-- - cada conta usa no máximo 2 dispositivos ao mesmo tempo, para todos os
--   papéis;
-- - todo login fica registrado (registro_de_acessos);
-- - no 3º dispositivo a pessoa entra, mas o app trava o uso até ela encerrar
--   um dos outros acessos; nas Configurações ela vê e derruba os acessos.
--
-- "Dispositivo" = sessão do Supabase Auth (auth.sessions): cada login num
-- navegador/aparelho cria uma. Encerrar apaga a sessão, o que revoga o
-- refresh token; o token de acesso já emitido ainda vale até expirar, por
-- isso o app consulta sessao_atual_ativa() periodicamente e sai sozinho.

CREATE TABLE IF NOT EXISTS public.registro_de_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registro_de_acessos IS
  'Um registro por login (sessão criada no Auth). Gravado pelo gatilho em auth.sessions; ninguém grava pelo app.';

CREATE INDEX IF NOT EXISTS idx_registro_de_acessos_user_id
  ON public.registro_de_acessos (user_id, created_at DESC);

ALTER TABLE public.registro_de_acessos ENABLE ROW LEVEL SECURITY;

-- Cada um vê os próprios acessos; developer vê todos (auditoria).
CREATE POLICY registro_de_acessos_select ON public.registro_de_acessos
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
  );

GRANT SELECT ON public.registro_de_acessos TO authenticated;

CREATE OR REPLACE FUNCTION public.registra_acesso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Falha aqui não pode impedir o login.
  BEGIN
    INSERT INTO public.registro_de_acessos (user_id, session_id, ip, user_agent)
    VALUES (NEW.user_id, NEW.id, host(NEW.ip), left(NEW.user_agent, 300));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'registro_de_acessos: falha ao registrar a sessão %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registra_acesso() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_registra_acesso ON auth.sessions;
CREATE TRIGGER trg_registra_acesso
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.registra_acesso();

-- Sessão da requisição atual, lida do JWT (claim session_id do Supabase).
CREATE OR REPLACE FUNCTION public.sessao_da_requisicao()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

-- Sessões válidas (não expiradas) de quem chama.
CREATE OR REPLACE FUNCTION public.minhas_sessoes()
RETURNS TABLE (
  id uuid,
  criada_em timestamptz,
  ultimo_uso timestamptz,
  ip text,
  user_agent text,
  atual boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at),
         host(s.ip),
         s.user_agent,
         s.id = public.sessao_da_requisicao()
    FROM auth.sessions s
   WHERE s.user_id = (SELECT auth.uid())
     AND (s.not_after IS NULL OR s.not_after > now())
   ORDER BY coalesce(s.refreshed_at, s.updated_at, s.created_at) DESC
$$;

-- Encerra um acesso da própria conta. Não encerra o acesso atual (para isso
-- existe o "Sair" do app).
CREATE OR REPLACE FUNCTION public.encerrar_sessao(p_sessao uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_apagadas int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória' USING ERRCODE = '42501';
  END IF;
  IF p_sessao = public.sessao_da_requisicao() THEN
    RAISE EXCEPTION 'Use "Sair" para encerrar o acesso atual' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.sessions WHERE id = p_sessao AND user_id = v_uid;
  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas > 0;
END;
$$;

-- O app chama periodicamente: false quando este acesso foi encerrado em outro
-- dispositivo (o token de acesso ainda não expirou, mas a sessão já não existe).
CREATE OR REPLACE FUNCTION public.sessao_atual_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.sessao_da_requisicao() IS NULL
      OR EXISTS (SELECT 1 FROM auth.sessions WHERE id = public.sessao_da_requisicao())
$$;

REVOKE ALL ON FUNCTION public.minhas_sessoes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encerrar_sessao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sessao_atual_ativa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_sessoes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_sessao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sessao_atual_ativa() TO authenticated;
