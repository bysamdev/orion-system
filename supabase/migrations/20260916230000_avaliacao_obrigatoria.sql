-- =================================================================================
-- Migration: 20260916230000_avaliacao_obrigatoria.sql
--
-- Demanda "Avaliação obrigatória de chamados" (P2).
--
-- ---------------------------------------------------------------------------
-- 1. Por que POLICY e não TRIGGER
--
-- src/lib/avaliacaoPendente.ts registra que a regra vivia no front DE
-- PROPÓSITO: "O banco NÃO bloqueia INSERT em tickets: abertura automática por
-- alerta crítico, abertura por técnico em nome do cliente e integrações
-- futuras passam pelo mesmo caminho e quebrariam."
--
-- A decisão continua válida para TRIGGER, que roda para todo mundo — inclusive
-- service_role. Mas uma cláusula de RLS não: service_role ignora RLS, então
-- lib.AbrirChamadoAlertaServidor, email-to-ticket e whatsapp-webhook seguem
-- abrindo chamado normalmente. E a equipe interna é isenta na própria
-- cláusula (decisão do dono do produto, 2026-09-16): sem isso, um técnico com
-- avaliação pendente não conseguiria abrir chamado em nome de cliente nenhum.
--
-- ---------------------------------------------------------------------------
-- 2. Fonte única da regra
--
-- A regra passa a viver aqui, e o front consome por RPC. Antes ela era
-- TypeScript; manter as duas cópias das mesmas cinco exclusões (cancelado,
-- janela, sem data de encerramento, mesclado, fechado por inatividade)
-- garantiria divergência com o tempo.
--
-- As funções NÃO recebem _user_id: leem auth.uid() por dentro. Receber o id
-- por parâmetro num SECURITY DEFINER deixaria qualquer autenticado consultar
-- número e título do último chamado encerrado de outra pessoa.
--
-- ---------------------------------------------------------------------------
-- 3. Janela de 30 dias
--
-- Mantida como válvula de escape: sem ela, um chamado antigo sem avaliação
-- trava a abertura para sempre. Mesmo valor que o front já usava.
--
-- Impacto retroativo medido antes de aplicar: dos 4 chamados encerrados sem
-- avaliação, nenhum bloquearia alguém — #1186 é fechado por inatividade,
-- #1173 está fora da janela, #1187 não é o último do usuário e #1188 é de um
-- técnico (equipe isenta).
-- =================================================================================

-- ── A regra ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chamado_pendente_de_avaliacao()
RETURNS TABLE (id uuid, ticket_number integer, title text, encerrado_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH ultimo AS (
    -- Só o ÚLTIMO encerrado importa. Se ele já foi avaliado, não bloqueia —
    -- mesmo que exista um mais antigo sem avaliação.
    SELECT t.id,
           t.ticket_number,
           t.title,
           COALESCE(t.closed_at, t.resolved_at) AS encerrado_em,
           t.metadata
      FROM public.tickets t
     WHERE t.user_id = (SELECT auth.uid())
       AND t.status IN ('resolved', 'closed')  -- 'cancelled' fica de fora: não houve atendimento a avaliar
       AND COALESCE(t.closed_at, t.resolved_at) IS NOT NULL
     ORDER BY COALESCE(t.closed_at, t.resolved_at) DESC
     LIMIT 1
  )
  SELECT u.id, u.ticket_number, u.title, u.encerrado_em
    FROM ultimo u
   WHERE NOT EXISTS (
           -- Qualquer linha resolve a pendência, inclusive as antigas com
           -- skipped = true: o "pular" existiu e não se pune ninguém
           -- retroativamente por uma regra que não valia na época.
           SELECT 1 FROM public.ticket_ratings r WHERE r.ticket_id = u.id
         )
     -- merged_into guarda o id do chamado que absorveu este; o cliente seria
     -- cobrado a avaliar um duplicado que talvez nem reconheça.
     AND COALESCE(u.metadata->>'merged_into', '') = ''
     -- fechado_por_inatividade é booleano no metadata. Sem esta exclusão a
     -- regra vira um laço perverso: o cliente ignora o chamado, ele fecha
     -- sozinho, e agora ele não abre chamado novo enquanto não avaliar o
     -- atendimento que ele mesmo abandonou.
     AND COALESCE((u.metadata->>'fechado_por_inatividade') = 'true', false) = false
     AND u.encerrado_em >= now() - interval '30 days';
$$;

COMMENT ON FUNCTION public.chamado_pendente_de_avaliacao() IS
  'Chamado encerrado do próprio usuário que ainda precisa de avaliação. Fonte única da regra: a policy de INSERT e o front (via RPC) leem daqui.';

CREATE OR REPLACE FUNCTION public.tem_avaliacao_pendente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.chamado_pendente_de_avaliacao());
$$;

REVOKE ALL ON FUNCTION public.chamado_pendente_de_avaliacao() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tem_avaliacao_pendente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamado_pendente_de_avaliacao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_avaliacao_pendente() TO authenticated;

-- ── O bloqueio ───────────────────────────────────────────────────────────────
--
-- Mesma policy criada em 20260916210000 (login individual + empresa própria),
-- agora com a avaliação pendente somada. Recriada inteira de propósito: uma
-- policy de INSERT só tem um WITH CHECK, não dá para acrescentar cláusula.

DROP POLICY IF EXISTS "Abertura exige login proprio e empresa propria" ON public.tickets;

CREATE POLICY "Abertura exige login proprio e empresa propria"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND NOT public.eh_usuario_de_maquina((SELECT auth.uid()))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'technician'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'developer'::public.app_role)
    OR company_id = public.get_user_company_id((SELECT auth.uid()))
  )
  AND (
    -- Equipe interna é isenta; usuário final precisa estar em dia.
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'technician'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'developer'::public.app_role)
    OR NOT public.tem_avaliacao_pendente()
  )
);

-- ── O e-mail ─────────────────────────────────────────────────────────────────

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS avaliacao_email_enviada_em timestamptz;

COMMENT ON COLUMN public.tickets.avaliacao_email_enviada_em IS
  'Quando o e-mail pedindo avaliação foi disparado. Guarda contra reenvio no ciclo resolvido -> reaberto -> resolvido.';

-- Dispara a Edge Function send-avaliacao-email quando o chamado é finalizado.
-- Mesmo molde de dispatch_due_report_schedules (20260902140000): net.http_post
-- do pg_net é fire-and-forget, com o segredo compartilhado vindo do Vault.
CREATE OR REPLACE FUNCTION public.dispara_email_de_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
DECLARE
  segredo text;
BEGIN
  -- Só na transição PARA encerrado. resolved -> closed não reenvia porque
  -- OLD.status já era um estado final.
  IF NEW.status NOT IN ('resolved', 'closed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('resolved', 'closed') THEN RETURN NEW; END IF;
  IF NEW.avaliacao_email_enviada_em IS NOT NULL THEN RETURN NEW; END IF;

  -- Mesmas exclusões da regra de pendência: não faz sentido cobrar avaliação
  -- de duplicado mesclado nem de chamado que fechou por abandono.
  IF COALESCE(NEW.metadata->>'merged_into', '') <> '' THEN RETURN NEW; END IF;
  IF COALESCE((NEW.metadata->>'fechado_por_inatividade') = 'true', false) THEN RETURN NEW; END IF;

  -- Conta-fantasma de máquina não é pessoa e não tem caixa de entrada.
  IF public.eh_usuario_de_maquina(NEW.user_id) THEN RETURN NEW; END IF;

  -- get_cron_dispatch_secret() levanta exceção quando o segredo não existe no
  -- Vault. Sem este bloco, a falta do segredo faria a FINALIZAÇÃO DO CHAMADO
  -- falhar — o técnico não conseguiria fechar nada. E-mail é acessório: se
  -- não dá para avisar, registra e segue.
  BEGIN
    segredo := public.get_cron_dispatch_secret();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'avaliacao: segredo de dispatch indisponível, e-mail não enviado para o chamado %', NEW.id;
    RETURN NEW;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://kcxwealimsfxqstoprdg.supabase.co/functions/v1/send-avaliacao-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', segredo
      ),
      body := jsonb_build_object('ticket_id', NEW.id)
    );
    NEW.avaliacao_email_enviada_em := now();
  EXCEPTION WHEN OTHERS THEN
    -- Mesmo raciocínio: uma falha ao enfileirar o e-mail não pode impedir o
    -- técnico de finalizar o chamado. Deixa a coluna nula para que uma
    -- reabertura seguida de nova finalização tente de novo.
    RAISE WARNING 'avaliacao: falha ao enfileirar e-mail do chamado %', NEW.id;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dispara_email_de_avaliacao ON public.tickets;

CREATE TRIGGER tr_dispara_email_de_avaliacao
  BEFORE UPDATE OF status ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.dispara_email_de_avaliacao();
