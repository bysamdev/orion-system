-- ORN-SEC-05: comando remoto não entra mais direto pela API do Supabase.
--
-- machine_commands aceitava INSERT e UPDATE de admin/técnico com qualquer
-- texto em "command". O agente executa esse texto (cmd /C) e "orion-install"
-- baixa e roda qualquer URL com o hash informado pelo próprio autor. A
-- allowlist de comandos só existia no handler Go, e dava para pular ela
-- gravando direto na tabela, com autoria (executed_by_*) forjada.
--
-- Agora:
--   - INSERT e UPDATE em machine_commands saem do frontend; comandos avulsos
--     passam pela API Go (allowlist) e o despacho de pacote pela função
--     despachar_pacote(), que lê URL e hash do cadastro do pacote e grava a
--     autoria a partir da sessão;
--   - SELECT e DELETE seguem como estavam (histórico e exclusão de máquina).

DROP POLICY IF EXISTS "Admins and techs can insert company machine commands" ON public.machine_commands;
DROP POLICY IF EXISTS "Admins and techs can update company machine commands" ON public.machine_commands;
REVOKE INSERT, UPDATE ON public.machine_commands FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.despachar_pacote(p_package_id uuid, p_machine_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_usuario uuid := public.get_user_company_id(v_uid);
  v_empresa_maquina uuid;
  v_pacote public.software_packages;
  v_nome text;
  v_comando uuid;
  v_deploy uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;

  SELECT company_id INTO v_empresa_maquina FROM public.machines WHERE id = p_machine_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Máquina não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_pacote FROM public.software_packages WHERE id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pacote não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Equipe interna despacha para qualquer máquina. Admin ou técnico de
  -- empresa cliente só despacha pacote da própria empresa para máquina da
  -- própria empresa.
  IF NOT (
    public.is_equipe_interna(v_uid)
    OR (
      (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'technician'::app_role))
      AND v_empresa_maquina IS NOT DISTINCT FROM v_empresa_usuario
      AND v_pacote.company_id IS NOT DISTINCT FROM v_empresa_usuario
      AND v_empresa_usuario IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para despachar este pacote' USING ERRCODE = '42501';
  END IF;

  IF coalesce(v_pacote.file_path, '') = '' OR coalesce(v_pacote.sha256_hash, '') !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Pacote sem arquivo ou hash SHA-256 válido' USING ERRCODE = '22023';
  END IF;
  IF position('"' in v_pacote.file_path) > 0 THEN
    RAISE EXCEPTION 'Caminho do pacote inválido' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.machine_commands (machine_id, command, executed_by_user_id, executed_by_name)
  VALUES (
    p_machine_id,
    format('orion-install --url="%s" --hash="%s"', v_pacote.file_path, lower(v_pacote.sha256_hash)),
    v_uid,
    coalesce(v_nome, 'Usuário')
  )
  RETURNING id INTO v_comando;

  INSERT INTO public.package_deployments (package_id, machine_id, command_id, status, dispatched_by)
  VALUES (p_package_id, p_machine_id, v_comando, 'dispatched', v_uid)
  RETURNING id INTO v_deploy;

  RETURN v_deploy;
END;
$$;

REVOKE ALL ON FUNCTION public.despachar_pacote(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despachar_pacote(uuid, uuid) TO authenticated;
