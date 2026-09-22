-- Botão para ligar e desligar o SLA do sistema inteiro (Painel Admin >
-- Configurações).
--
-- Desligado: chamado novo nasce sem prazo (sla_due_date e sla_status nulos) e
-- os chamados abertos perdem o prazo. As telas já tratam prazo nulo como "sem
-- SLA", e o recálculo do pg_cron (update_all_tickets_sla_status) ignora
-- chamado sem prazo, então não sai alerta nem notificação.
--
-- Religado: os chamados abertos ganham o prazo de novo, calculado pela
-- prioridade a partir da abertura, mais o tempo que já ficaram pausados.

CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Leitura para qualquer usuário logado: as telas precisam saber se mostram
-- SLA. Escrita só pela função definir_sla_ativo, que confere o papel.
DROP POLICY IF EXISTS "Usuários logados leem as configurações" ON public.configuracoes_sistema;
CREATE POLICY "Usuários logados leem as configurações" ON public.configuracoes_sistema
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.configuracoes_sistema FROM anon, authenticated;
GRANT SELECT ON public.configuracoes_sistema TO authenticated;

INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('sla_ativo', 'true'::jsonb)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sla_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce((SELECT valor = 'true'::jsonb FROM public.configuracoes_sistema WHERE chave = 'sla_ativo'), true)
$$;

-- Chamado novo: sem SLA ligado, nasce sem prazo.
CREATE OR REPLACE FUNCTION public.set_ticket_sla_on_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.sla_ativo() THEN
    NEW.sla_due_date := NULL;
    NEW.sla_status := NULL;
    RETURN NEW;
  END IF;

  NEW.sla_due_date := calculate_sla_due_date(NEW.priority, NEW.created_at);
  NEW.sla_status := 'ok';
  RETURN NEW;
END;
$$;

-- Troca de prioridade: só recalcula o prazo com o SLA ligado.
CREATE OR REPLACE FUNCTION public.update_sla_on_priority_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority AND public.sla_ativo() THEN
    NEW.sla_due_date := calculate_sla_due_date(NEW.priority, OLD.created_at);
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
       SET sla_due_date = calculate_sla_due_date(priority, created_at)
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

REVOKE ALL ON FUNCTION public.definir_sla_ativo(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_sla_ativo(boolean) TO authenticated;
