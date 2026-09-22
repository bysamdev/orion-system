-- O prazo do chamado passa a seguir a Política de SLA da empresa.
--
-- Antes, calculate_sla_due_date tinha horas fixas e corridas (urgente 2h,
-- alta 4h, média 24h, baixa 48h) e ninguém lia sla_configs: mudar a política
-- na tela não mudava prazo nenhum, e "Apenas Horário Comercial" não pausava
-- nada.
--
-- Qual política vale para a empresa:
--   1. a do contrato ativo e vigente da empresa (contracts.sla_config_id);
--   2. senão, a política mais antiga da empresa (a "Padrão" criada junto);
--   3. senão, as horas fixas de antes (calculate_sla_due_date), para empresa
--      sem política nenhuma.
--
-- Com business_hours_only, só contam as horas entre business_start e
-- business_end, de segunda a sexta, no horário de Brasília.

CREATE OR REPLACE FUNCTION public.politica_sla_da_empresa(p_company_id uuid)
RETURNS public.sla_configs
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v public.sla_configs;
BEGIN
  SELECT s.* INTO v
    FROM public.contracts c
    JOIN public.sla_configs s ON s.id = c.sla_config_id
   WHERE c.company_id = p_company_id
     AND c.is_active
     AND (c.start_date IS NULL OR c.start_date <= current_date)
     AND (c.end_date IS NULL OR c.end_date >= current_date)
   ORDER BY c.start_date DESC NULLS LAST, c.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN v;
  END IF;

  SELECT s.* INTO v
    FROM public.sla_configs s
   WHERE s.company_id = p_company_id
   ORDER BY s.created_at
   LIMIT 1;
  IF FOUND THEN
    RETURN v;
  END IF;

  RETURN NULL;
END;
$$;

-- Soma p_horas a p_inicio contando só o expediente (segunda a sexta, entre
-- p_abre e p_fecha, horário de Brasília). Fora do expediente o relógio para.
CREATE OR REPLACE FUNCTION public.somar_horas_uteis(
  p_inicio timestamptz, p_horas numeric, p_abre time, p_fecha time
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_local timestamp := p_inicio AT TIME ZONE 'America/Sao_Paulo';
  v_restante interval := make_interval(secs => p_horas * 3600);
  v_dia date;
  v_abre timestamp;
  v_fecha timestamp;
  v_disponivel interval;
  v_voltas int := 0;
BEGIN
  IF p_horas IS NULL OR p_horas <= 0 OR p_abre IS NULL OR p_fecha IS NULL OR p_fecha <= p_abre THEN
    RETURN p_inicio + make_interval(secs => coalesce(p_horas, 0) * 3600);
  END IF;

  LOOP
    v_voltas := v_voltas + 1;
    EXIT WHEN v_voltas > 3700; -- trava de segurança (~10 anos de dias)

    v_dia := v_local::date;
    v_abre := v_dia + p_abre;
    v_fecha := v_dia + p_fecha;

    -- Sábado (6) e domingo (0), ou já passou do expediente: próximo dia.
    IF extract(dow FROM v_dia) IN (0, 6) OR v_local >= v_fecha THEN
      v_local := (v_dia + 1) + p_abre;
      CONTINUE;
    END IF;

    IF v_local < v_abre THEN
      v_local := v_abre;
    END IF;

    v_disponivel := v_fecha - v_local;
    IF v_restante <= v_disponivel THEN
      RETURN (v_local + v_restante) AT TIME ZONE 'America/Sao_Paulo';
    END IF;

    v_restante := v_restante - v_disponivel;
    v_local := (v_dia + 1) + p_abre;
  END LOOP;

  RETURN (v_local + v_restante) AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_prazo_sla(
  p_company_id uuid, p_priority text, p_inicio timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v public.sla_configs;
  v_horas numeric;
BEGIN
  v := public.politica_sla_da_empresa(p_company_id);
  IF v.id IS NULL THEN
    RETURN public.calculate_sla_due_date(p_priority, p_inicio);
  END IF;

  v_horas := CASE p_priority
    WHEN 'urgent' THEN v.urgent_hours
    WHEN 'high' THEN v.high_hours
    WHEN 'medium' THEN v.medium_hours
    WHEN 'low' THEN v.low_hours
    ELSE v.medium_hours
  END;

  IF v.business_hours_only THEN
    RETURN public.somar_horas_uteis(p_inicio, v_horas, v.business_start::time, v.business_end::time);
  END IF;
  RETURN p_inicio + make_interval(secs => v_horas * 3600);
END;
$$;

-- Abertura. O gatilho da empresa (trigger_set_ticket_company) roda depois
-- deste, por ordem alfabética, então a empresa pode ainda não estar em
-- NEW.company_id: cai para a empresa de quem abriu.
CREATE OR REPLACE FUNCTION public.set_ticket_sla_on_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF NOT public.sla_ativo() THEN
    NEW.sla_due_date := NULL;
    NEW.sla_status := NULL;
    RETURN NEW;
  END IF;

  v_empresa := coalesce(NEW.company_id, (SELECT company_id FROM public.profiles WHERE id = NEW.user_id));
  NEW.sla_due_date := public.calcular_prazo_sla(v_empresa, NEW.priority, coalesce(NEW.created_at, now()));
  NEW.sla_status := 'ok';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sla_on_priority_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority AND public.sla_ativo() THEN
    NEW.sla_due_date := public.calcular_prazo_sla(NEW.company_id, NEW.priority, OLD.created_at)
                        + make_interval(mins => coalesce(NEW.sla_accumulated_pause_minutes, 0));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.definir_sla_ativo(p_ativo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (
    public.has_role(v_uid, 'developer'::app_role)
    OR (public.has_role(v_uid, 'admin'::app_role) AND public.is_master_company_user(v_uid))
  ) THEN
    RAISE EXCEPTION 'Só desenvolvedor ou admin da empresa mãe liga ou desliga o SLA'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.configuracoes_sistema (chave, valor, updated_at, updated_by)
  VALUES ('sla_ativo', to_jsonb(p_ativo), now(), v_uid)
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  IF p_ativo THEN
    UPDATE public.tickets
       SET sla_due_date = public.calcular_prazo_sla(company_id, priority, created_at)
                          + make_interval(mins => coalesce(sla_accumulated_pause_minutes, 0)),
           sla_status = 'ok'
     WHERE status NOT IN ('resolved', 'closed', 'cancelled')
       AND sla_due_date IS NULL;
    PERFORM public.update_all_tickets_sla_status();
  ELSE
    UPDATE public.tickets
       SET sla_due_date = NULL, sla_status = NULL
     WHERE status NOT IN ('resolved', 'closed', 'cancelled')
       AND (sla_due_date IS NOT NULL OR sla_status IS NOT NULL);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.politica_sla_da_empresa(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calcular_prazo_sla(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_prazo_sla(uuid, text, timestamptz) TO authenticated;
