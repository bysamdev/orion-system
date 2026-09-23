-- ORN-INC-03: o limite de abertura de chamados (anti-spam) só era conferido
-- pela Edge check-rate-limit, que a tela consulta antes de gravar; quem
-- chamava a API direto abria quantos quisesse. Decisão de 23/09/2026: travar
-- também no banco, com as mesmas regras da Edge:
--   - 2 minutos entre um chamado e o próximo do mesmo usuário;
--   - no máximo 10 chamados por hora por usuário.
--
-- Ficam de fora: equipe interna, abertura sem sessão (cron, service_role,
-- backend Go) e usuário de máquina (chamado automático). Os testes pgTAP
-- abrem vários chamados seguidos do mesmo cliente e desligam a trava com
-- SET LOCAL orion.limite_de_abertura = 'off'; a API do Supabase não expõe
-- set_config, então isso só é possível direto no banco.

CREATE OR REPLACE FUNCTION public.limite_de_abertura_de_chamados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ultimo timestamptz;
  v_na_hora int;
BEGIN
  IF v_uid IS NULL
     OR current_setting('orion.limite_de_abertura', true) = 'off'
     OR public.is_equipe_interna(v_uid)
     OR public.eh_usuario_de_maquina(v_uid) THEN
    RETURN NEW;
  END IF;

  SELECT max(created_at), count(*) FILTER (WHERE created_at > now() - interval '1 hour')
    INTO v_ultimo, v_na_hora
    FROM public.tickets
   WHERE user_id = v_uid
     AND created_at > now() - interval '1 hour';

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Aguarde % segundos antes de abrir outro chamado',
      ceil(extract(epoch FROM (v_ultimo + interval '2 minutes' - now())))::int
      USING ERRCODE = 'P0001';
  END IF;

  IF v_na_hora >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 chamados por hora atingido. Tente novamente mais tarde'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limite_de_abertura_de_chamados() FROM PUBLIC, anon, authenticated;

-- Nome com "a0_" para rodar antes dos outros BEFORE INSERT (ordem
-- alfabética): recusar cedo, antes de roteamento e SLA.
DROP TRIGGER IF EXISTS a0_limite_de_abertura_de_chamados ON public.tickets;
CREATE TRIGGER a0_limite_de_abertura_de_chamados
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.limite_de_abertura_de_chamados();
