-- =============================================================================
-- Alerta por e-mail quando o banco entra em laço de erros
-- =============================================================================
--
-- POR QUE EXISTE
--
-- No incidente de 18/09/2026 (migration 20260918030000) o banco passou seis dias
-- a 100% de CPU, com mais de 8 milhões de erros por dia, e ninguém foi avisado.
-- Só se percebeu pelo aviso de CPU no painel do Supabase. O sintoma era gritante
-- e fácil de medir; faltava só alguém olhando.
--
-- O QUE MEDE
--
-- O crescimento de pg_stat_database.xact_rollback entre duas leituras. Cada
-- transação que falha é desfeita e incrementa esse contador, então ele pega
-- qualquer laço de erros, venha de onde vier, sem ler log nenhum. É um número
-- só, que o próprio Postgres mantém: a medição não custa praticamente nada.
--
-- O LIMIAR
--
-- 5 rollbacks por segundo, na média da janela de 5 minutos. Medido em
-- 18/09/2026:
--
--   normal, depois da correção do incidente:  ~0,1 por segundo
--   durante o incidente:                      ~1.470 por segundo
--
-- 5/s fica 50 vezes acima do normal e 300 vezes abaixo do incidente: folga dos
-- dois lados para não gritar à toa e não deixar passar.
--
-- POR QUE MORA NO BANCO
--
-- O servidor de monitoramento tem Prometheus e Grafana, mas ele fica desligado
-- às vezes — e estava desligado durante o incidente. Um alerta que dependesse
-- dele não teria disparado. O pg_cron roda junto com o banco: se o banco está de
-- pé para errar, ele está de pé para avisar.
--
-- COMO AVISA
--
-- Pelo mesmo caminho do e-mail de avaliação: net.http_post para uma Edge
-- Function (alerta-saude-banco), autenticada pelo mesmo segredo compartilhado.
-- Nenhuma credencial nova.
--
-- Três mensagens, para o aviso ser útil e não virar ruído:
--
--   inicio       a anomalia começou;
--   persiste     continua — no máximo uma por hora, em vez de uma a cada 5 min;
--   normalizado  voltou ao normal, com a duração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Estado entre uma leitura e outra (linha única)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saude_do_banco (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rollbacks_lidos   bigint,
  lido_em           timestamptz,
  ultima_taxa       numeric,
  em_alerta         boolean NOT NULL DEFAULT false,
  anomalia_desde    timestamptz,
  alerta_enviado_em timestamptz
);

COMMENT ON TABLE public.saude_do_banco IS
  'Estado do alerta de laço de erros: última leitura de xact_rollback e se há '
  'alerta aberto. Linha única, mantida por verificar_saude_do_banco().';

-- Só a função (SECURITY DEFINER) lê e escreve aqui. RLS ligada e sem policy
-- nenhuma fecha a tabela para anon e authenticated pela API.
ALTER TABLE public.saude_do_banco ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saude_do_banco FROM anon, authenticated;

INSERT INTO public.saude_do_banco (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Medição e decisão
-- -----------------------------------------------------------------------------
-- p_limiar existe para dar para testar o caminho do alerta de ponta a ponta sem
-- precisar provocar um incidente de verdade. O pg_cron chama sem argumento.
--
-- Devolve a decisão tomada, só para quem chamar à mão conseguir ver.
CREATE OR REPLACE FUNCTION public.verificar_saude_do_banco(p_limiar numeric DEFAULT 5)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_temp'
AS $$
DECLARE
  v_agora    timestamptz := clock_timestamp();
  v_atual    bigint;
  v_estado   public.saude_do_banco;
  v_segundos numeric;
  v_taxa     numeric;
  v_anormal  boolean;
  v_tipo     text;
  v_desde    timestamptz;
  v_segredo  text;
BEGIN
  SELECT xact_rollback INTO v_atual
    FROM pg_stat_database
   WHERE datname = current_database();

  -- FOR UPDATE: se duas execuções se sobrepuserem, a segunda espera a primeira
  -- em vez de as duas mandarem o mesmo e-mail.
  SELECT * INTO v_estado FROM public.saude_do_banco WHERE id = 1 FOR UPDATE;

  -- Primeira leitura, ou o contador foi zerado (reinício do banco ou reset das
  -- estatísticas). Sem um ponto anterior válido não há taxa a calcular: só
  -- guarda a linha de base e espera a próxima execução.
  IF v_estado.rollbacks_lidos IS NULL OR v_atual < v_estado.rollbacks_lidos THEN
    UPDATE public.saude_do_banco
       SET rollbacks_lidos = v_atual, lido_em = v_agora
     WHERE id = 1;
    RETURN 'linha_de_base';
  END IF;

  v_segundos := GREATEST(EXTRACT(EPOCH FROM (v_agora - v_estado.lido_em)), 1);
  v_taxa     := (v_atual - v_estado.rollbacks_lidos) / v_segundos;
  v_anormal  := v_taxa >= p_limiar;

  IF v_anormal AND NOT v_estado.em_alerta THEN
    v_tipo  := 'inicio';
    -- A anomalia começou em algum momento desde a leitura anterior, que ainda
    -- estava normal. É o melhor palpite de início que dá para ter.
    v_desde := v_estado.lido_em;
  ELSIF v_anormal AND v_estado.em_alerta
        AND v_agora - v_estado.alerta_enviado_em >= interval '1 hour' THEN
    v_tipo  := 'persiste';
    v_desde := v_estado.anomalia_desde;
  ELSIF NOT v_anormal AND v_estado.em_alerta THEN
    v_tipo  := 'normalizado';
    v_desde := v_estado.anomalia_desde;
  END IF;

  UPDATE public.saude_do_banco
     SET rollbacks_lidos   = v_atual,
         lido_em           = v_agora,
         ultima_taxa       = round(v_taxa, 3),
         em_alerta         = v_anormal,
         anomalia_desde    = CASE
                               WHEN v_tipo = 'inicio'      THEN v_desde
                               WHEN v_tipo = 'normalizado' THEN NULL
                               ELSE anomalia_desde
                             END,
         alerta_enviado_em = CASE
                               WHEN v_tipo IN ('inicio', 'persiste') THEN v_agora
                               ELSE alerta_enviado_em
                             END
   WHERE id = 1;

  IF v_tipo IS NOT NULL THEN
    -- Falha no envio nunca derruba a verificação: a leitura já foi guardada e a
    -- próxima execução segue normalmente. Mesmo desenho do e-mail de avaliação.
    BEGIN
      v_segredo := public.get_cron_dispatch_secret();

      PERFORM net.http_post(
        url     := 'https://kcxwealimsfxqstoprdg.supabase.co/functions/v1/alerta-saude-banco',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', v_segredo
        ),
        body    := jsonb_build_object(
          'tipo',             v_tipo,
          'taxa_por_segundo', round(v_taxa, 3),
          'janela_segundos',  round(v_segundos),
          'desde',            v_desde
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'saude do banco: falha ao enfileirar alerta % (taxa %/s): %', v_tipo, round(v_taxa, 2), SQLERRM;
    END;
  END IF;

  RETURN COALESCE(v_tipo, CASE WHEN v_anormal THEN 'em_alerta' ELSE 'normal' END)
         || ' taxa=' || round(v_taxa, 2) || '/s';
END;
$$;

COMMENT ON FUNCTION public.verificar_saude_do_banco(numeric) IS
  'Mede a taxa de rollbacks desde a última leitura e avisa por e-mail quando '
  'passa de p_limiar por segundo. Chamada a cada 5 minutos pelo pg_cron.';

-- SECURITY DEFINER em public é chamável por qualquer papel por padrão, e esta
-- lê o segredo de disparo. Só o pg_cron (postgres) precisa executá-la.
REVOKE ALL ON FUNCTION public.verificar_saude_do_banco(numeric) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Agendamento
-- -----------------------------------------------------------------------------
-- Idempotente: remove antes de recriar, para a migration poder rodar de novo.
DO $$
BEGIN
  PERFORM cron.unschedule('verificar-saude-do-banco')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verificar-saude-do-banco');
END;
$$;

SELECT cron.schedule(
  'verificar-saude-do-banco',
  '*/5 * * * *',
  'SELECT public.verificar_saude_do_banco()'
);
