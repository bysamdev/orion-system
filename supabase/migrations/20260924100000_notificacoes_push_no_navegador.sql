-- INC-04 (decisão de 23/09/2026): o aviso de mudança de status vai por
-- notificação do navegador (Web Push), recebida mesmo com o site fechado.
--
-- Desenho: toda linha nova em notifications (a mudança de status já grava
-- uma, via 20260811000000_notify_on_status_change) dispara a Edge
-- enviar-push, que manda o aviso para todos os navegadores inscritos do
-- usuário. Mesmo molde do e-mail de avaliação: net.http_post fire-and-forget
-- com o segredo compartilhado do Vault; falha no envio nunca desfaz a
-- notificação.

CREATE TABLE IF NOT EXISTS public.push_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_inscricoes IS
  'Inscrições de Web Push por navegador. Cada usuário pode ter várias (celular, PC). A Edge enviar-push apaga as que o navegador invalidou (404/410).';

CREATE INDEX IF NOT EXISTS idx_push_inscricoes_user_id ON public.push_inscricoes (user_id);

ALTER TABLE public.push_inscricoes ENABLE ROW LEVEL SECURITY;

-- Cada um só enxerga, cria e apaga as inscrições dos próprios navegadores.
-- Não há UPDATE: o navegador que troca de chave gera inscrição nova.
CREATE POLICY push_inscricoes_select ON public.push_inscricoes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY push_inscricoes_insert ON public.push_inscricoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY push_inscricoes_delete ON public.push_inscricoes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.push_inscricoes TO authenticated;

CREATE OR REPLACE FUNCTION public.dispara_push_da_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
DECLARE
  segredo text;
BEGIN
  -- Sem navegador inscrito não há o que enviar; evita uma chamada por
  -- notificação para quem nunca ligou o push.
  IF NOT EXISTS (SELECT 1 FROM public.push_inscricoes WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    segredo := public.get_cron_dispatch_secret();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push: segredo de dispatch indisponível, notificação % não enviada', NEW.id;
    RETURN NEW;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://kcxwealimsfxqstoprdg.supabase.co/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', segredo
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push: falha ao enfileirar a notificação %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispara_push_da_notificacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dispara_push_da_notificacao ON public.notifications;
CREATE TRIGGER trg_dispara_push_da_notificacao
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispara_push_da_notificacao();
