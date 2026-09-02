// Item 1.8 (acabamento MVP): dispara pelo cron `dispatch-report-schedules`
// (public.dispatch_due_report_schedules(), via pg_net) — não é chamada por usuário
// autenticado, por isso verify_jwt=false em supabase/config.toml e a autenticação é
// por secret compartilhado (header x-cron-secret == env CRON_DISPATCH_SECRET, mesmo
// valor gravado no Vault como orion_cron_dispatch_secret).
//
// Gera um PDF de resumo (não os ~12 gráficos completos de src/pages/Reports.tsx) e
// envia por e-mail via Resend. O PDF atual do app (src/lib/reports/exportPdf.ts)
// captura SVGs já renderizados no DOM do browser, o que não existe em Edge Function
// (Deno, sem DOM/headless browser) — aqui o "gráfico" é desenhado com as primitivas
// vetoriais do próprio jsPDF (retângulos/texto), sem depender de Recharts.
//
// As cores abaixo duplicam (não importam) src/lib/state-tokens.ts: uma Edge Function
// é um projeto Deno separado de src/, e importar por caminho relativo para fora de
// supabase/functions/ não é garantido no deploy. Se a paleta de status mudar em
// state-tokens.ts, atualize aqui também.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { jsPDF } from "npm:jspdf@4.2.1";

interface StatusCount {
  status: string;
  label: string;
  color: [number, number, number];
  count: number;
}

const STATUS_META: Record<string, { label: string; color: [number, number, number] }> = {
  'open': { label: 'Aberto', color: [59, 130, 246] },
  'in-progress': { label: 'Em Atendimento', color: [6, 182, 212] },
  'awaiting-customer': { label: 'Aguard. Cliente', color: [168, 85, 247] },
  'awaiting-third-party': { label: 'Aguard. Terceiro', color: [99, 102, 241] },
  'resolved': { label: 'Resolvido', color: [16, 185, 129] },
  'closed': { label: 'Concluído', color: [148, 163, 184] },
  'reopened': { label: 'Reaberto', color: [249, 115, 22] },
  'cancelled': { label: 'Cancelado', color: [100, 116, 139] },
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function computePeriod(frequency: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (frequency === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const label = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }
  const end = now;
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end, label: `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}` };
}

function buildReportPdf(periodLabel: string, statusCounts: StatusCount[], totalOpened: number, totalResolved: number, slaOkPct: number | null): ArrayBuffer {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Orion System — Resumo de Chamados', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Período: ${periodLabel}`, 14, 28);

  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.text('Resumo', 14, 42);
  doc.setFontSize(10);
  doc.text(`Chamados abertos no período: ${totalOpened}`, 14, 50);
  doc.text(`Chamados resolvidos no período: ${totalResolved}`, 14, 56);
  doc.text(`Dentro do SLA: ${slaOkPct === null ? 'sem dados' : `${slaOkPct}%`}`, 14, 62);

  doc.setFontSize(13);
  doc.text('Chamados por Status', 14, 78);

  const chartX = 14;
  const chartBaseY = 130;
  const chartH = 45;
  const barCount = Math.max(statusCounts.length, 1);
  const slotW = 180 / barCount;
  const barW = slotW - 6;
  const maxVal = Math.max(1, ...statusCounts.map((s) => s.count));

  statusCounts.forEach((s, i) => {
    const barH = (s.count / maxVal) * chartH;
    const x = chartX + i * slotW;
    const y = chartBaseY - barH;
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    doc.rect(x, y, barW, barH, 'F');
    doc.setFontSize(8);
    doc.setTextColor(20);
    doc.text(String(s.count), x, y - 2);
    doc.setFontSize(6.5);
    doc.text(s.label, x, chartBaseY + 6, { maxWidth: barW });
  });

  doc.setDrawColor(180);
  doc.line(chartX, chartBaseY, chartX + 180, chartBaseY);

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, 14, 285);

  return doc.output('arraybuffer');
}

serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_DISPATCH_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const { schedule_id } = await req.json();
    if (!schedule_id) {
      return new Response(JSON.stringify({ error: 'schedule_id ausente' }), { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('report_schedules')
      .select('id, recipients, frequency')
      .eq('id', schedule_id)
      .single();

    if (scheduleError || !schedule) {
      console.error('Agendamento não encontrado:', scheduleError);
      return new Response(JSON.stringify({ error: 'Agendamento não encontrado' }), { status: 404 });
    }

    const { start, end, label: periodLabel } = computePeriod(schedule.frequency);

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select('status, sla_status, sla_due_date, created_at, resolved_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (ticketsError) {
      console.error('Erro ao buscar chamados:', ticketsError);
      throw new Error('Erro ao buscar chamados do período');
    }

    const rows = tickets ?? [];
    const totalOpened = rows.length;
    const totalResolved = rows.filter((t) => t.resolved_at).length;
    const withSlaDueDate = rows.filter((t) => t.sla_due_date);
    const slaOkPct = withSlaDueDate.length > 0
      ? Math.round((withSlaDueDate.filter((t) => t.sla_status !== 'breached').length / withSlaDueDate.length) * 100)
      : null;

    const countByStatus = new Map<string, number>();
    for (const t of rows) {
      countByStatus.set(t.status, (countByStatus.get(t.status) || 0) + 1);
    }
    const statusCounts: StatusCount[] = Array.from(countByStatus.entries())
      .map(([status, count]) => ({
        status,
        label: STATUS_META[status]?.label || status,
        color: STATUS_META[status]?.color || [148, 163, 184],
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const pdfBuffer = buildReportPdf(periodLabel, statusCounts, totalOpened, totalResolved, slaOkPct);
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY não configurada');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5;">
        <div style="max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 20px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Orion System</h1>
          </div>
          <div style="padding:32px 30px;">
            <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:18px;">Resumo de Chamados — ${periodLabel}</h2>
            <p style="margin:0 0 8px 0;color:#4a5568;font-size:14px;">Chamados abertos no período: <strong>${totalOpened}</strong></p>
            <p style="margin:0 0 8px 0;color:#4a5568;font-size:14px;">Chamados resolvidos no período: <strong>${totalResolved}</strong></p>
            <p style="margin:0 0 20px 0;color:#4a5568;font-size:14px;">Dentro do SLA: <strong>${slaOkPct === null ? 'sem dados' : `${slaOkPct}%`}</strong></p>
            <p style="margin:0;color:#718096;font-size:13px;">O relatório completo está em anexo (PDF).</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Orion System <orionsystem@bysam.dev>',
        to: schedule.recipients,
        subject: `Relatório Orion System — ${periodLabel}`,
        html: emailHtml,
        attachments: [
          { filename: `relatorio-orion-${schedule.frequency}.pdf`, content: pdfBase64 },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Erro ao enviar e-mail via Resend:', errorData);
      throw new Error(`Erro ao enviar e-mail: ${emailResponse.statusText}`);
    }

    return new Response(JSON.stringify({ success: true, totalOpened, totalResolved, slaOkPct }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro em send-scheduled-report:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
    });
  }
});
