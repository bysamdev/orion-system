-- Migration: 20260820200000_add_user_backup_codes.sql
-- Descrição: Criação da tabela de códigos de backup 2FA (hasheados com SHA-256) e funções RPC seguras.

CREATE TABLE IF NOT EXISTS public.user_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz NULL
);

-- Comentários para documentação
COMMENT ON TABLE public.user_backup_codes IS 'Armazena hashes de códigos de recuperação/backup para autenticação em dois fatores (2FA)';
COMMENT ON COLUMN public.user_backup_codes.code_hash IS 'Hash SHA-256 do código de backup gerado';
COMMENT ON COLUMN public.user_backup_codes.used_at IS 'Data/hora em que o código foi consumido (NULL = disponível)';

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_user_id ON public.user_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_user_hash ON public.user_backup_codes(user_id, code_hash);
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_available ON public.user_backup_codes(user_id) WHERE used_at IS NULL;

-- Habilitar RLS
ALTER TABLE public.user_backup_codes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuário autenticado só pode ver/modificar seus próprios registros
DROP POLICY IF EXISTS "Users can view own backup codes" ON public.user_backup_codes;
CREATE POLICY "Users can view own backup codes"
  ON public.user_backup_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own backup codes" ON public.user_backup_codes;
CREATE POLICY "Users can delete own backup codes"
  ON public.user_backup_codes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own backup codes" ON public.user_backup_codes;
CREATE POLICY "Users can insert own backup codes"
  ON public.user_backup_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RPC: Salvar novo conjunto de códigos de backup (substitui os anteriores)
CREATE OR REPLACE FUNCTION public.save_user_backup_codes(p_code_hashes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Remove códigos antigos do usuário
  DELETE FROM public.user_backup_codes WHERE user_id = v_user_id;

  -- Insere os novos hashes
  IF p_code_hashes IS NOT NULL AND array_length(p_code_hashes, 1) > 0 THEN
    FOREACH v_hash IN ARRAY p_code_hashes
    LOOP
      INSERT INTO public.user_backup_codes (user_id, code_hash)
      VALUES (v_user_id, v_hash);
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_backup_codes(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_user_backup_codes(text[]) TO authenticated;

-- RPC: Verificar e consumir um código de backup
CREATE OR REPLACE FUNCTION public.verify_user_backup_code(p_code_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Busca código não utilizado correspondente com bloqueio de linha
  SELECT id INTO v_code_id
  FROM public.user_backup_codes
  WHERE user_id = v_user_id
    AND code_hash = p_code_hash
    AND used_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_code_id IS NOT NULL THEN
    UPDATE public.user_backup_codes
    SET used_at = now()
    WHERE id = v_code_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_backup_code(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_user_backup_code(text[]) TO authenticated;

-- RPC: Obter status/contagem dos códigos de backup
CREATE OR REPLACE FUNCTION public.get_backup_codes_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total int;
  v_remaining int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('total', 0, 'remaining', 0);
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.user_backup_codes
  WHERE user_id = v_user_id;

  SELECT count(*)::int INTO v_remaining
  FROM public.user_backup_codes
  WHERE user_id = v_user_id AND used_at IS NULL;

  RETURN json_build_object('total', v_total, 'remaining', v_remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.get_backup_codes_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_backup_codes_status() TO authenticated;
