-- Item 1.8 (acabamento MVP): agendamento de relatório por e-mail. Aditivo, não toca
-- autorização/RLS existente — segue o mesmo padrão unificado (is_equipe_interna) já
-- usado em contracts/sla_configs (20260901220000) e em contract_billing_cycles
-- (20260902130000). Reports.tsx já é staff-only (customer é redirecionado em
-- src/pages/Reports.tsx:313), então agendamento segue a mesma regra.
--
-- Decisão do usuário: PDF com gráfico (não XLSX/tabela simples). A exportação PDF
-- atual (src/lib/reports/exportPdf.ts) captura SVGs já renderizados no DOM do
-- browser — isso não existe em Edge Function (Deno, sem DOM/headless browser). A
-- function supabase/functions/send-scheduled-report desenha o gráfico com as
-- primitivas vetoriais do próprio jsPDF (retângulos/texto via npm:jspdf), sem
-- depender de Recharts nem de captura de DOM.

CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipients text[] NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_schedules_due ON public.report_schedules(next_run_at) WHERE is_active = true;

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe interna gerencia agendamentos de relatorio"
ON public.report_schedules
FOR ALL
TO authenticated
USING (is_equipe_interna(auth.uid()))
WITH CHECK (is_equipe_interna(auth.uid()));

CREATE TRIGGER set_updated_at_report_schedules
BEFORE UPDATE ON public.report_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Lê o secret compartilhado com a Edge Function (mesmo padrão de
-- get_encryption_key() em 20260813130000_remove_hardcoded_encryption_key.sql).
-- Antes de habilitar o cron abaixo, é preciso criar o secret no Vault:
--   select vault.create_secret('<valor-aleatorio>', 'orion_cron_dispatch_secret');
-- e configurar o MESMO valor como env var CRON_DISPATCH_SECRET da Edge Function
-- send-scheduled-report (supabase secrets set CRON_DISPATCH_SECRET=<mesmo-valor>).
CREATE OR REPLACE FUNCTION public.get_cron_dispatch_secret()
RETURNS TEXT AS $$
DECLARE
    k TEXT;
BEGIN
    SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'orion_cron_dispatch_secret'
    LIMIT 1;

    IF k IS NULL OR k = '' THEN
        RAISE EXCEPTION 'Secret orion_cron_dispatch_secret não encontrado no Supabase Vault — crie-o via vault.create_secret() e configure o mesmo valor como env var CRON_DISPATCH_SECRET na Edge Function send-scheduled-report antes de habilitar o agendamento.';
    END IF;
    RETURN k;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, vault;

-- Dispara a Edge Function para cada agendamento vencido e avança next_run_at.
-- net.http_post (pg_net, já habilitado em 20251203065524_...) é fire-and-forget:
-- não espera a resposta, então o avanço de next_run_at é otimista — sem retry.
CREATE OR REPLACE FUNCTION public.dispatch_due_report_schedules()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dispatched_count INTEGER := 0;
  schedule_row RECORD;
BEGIN
  FOR schedule_row IN
    SELECT id, frequency FROM report_schedules
    WHERE is_active = true AND next_run_at <= now()
  LOOP
    PERFORM net.http_post(
      url := 'https://kcxwealimsfxqstoprdg.supabase.co/functions/v1/send-scheduled-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.get_cron_dispatch_secret()
      ),
      body := jsonb_build_object('schedule_id', schedule_row.id)
    );

    UPDATE report_schedules
    SET
      last_sent_at = now(),
      next_run_at = CASE schedule_row.frequency
        WHEN 'weekly' THEN now() + INTERVAL '7 days'
        WHEN 'monthly' THEN now() + INTERVAL '1 month'
        ELSE now() + INTERVAL '7 days'
      END,
      updated_at = now()
    WHERE id = schedule_row.id;

    dispatched_count := dispatched_count + 1;
  END LOOP;

  RETURN dispatched_count;
END;
$$;

-- Verifica agendamentos vencidos a cada hora (granularidade suficiente para
-- frequências semanal/mensal).
SELECT cron.schedule(
  'dispatch-report-schedules',
  '0 * * * *',
  $$SELECT public.dispatch_due_report_schedules()$$
);
