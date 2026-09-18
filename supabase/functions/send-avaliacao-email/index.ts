// E-mail de pedido de avaliação: disparado por trigger no banco (net.http_post,
// fire-and-forget) quando um chamado é finalizado. Complementa a notificação in-app
// que já existe via trigger em ticket_updates.
//
// Não é chamada por usuário autenticado, por isso a autenticação é por secret
// compartilhado (header x-cron-secret == env CRON_DISPATCH_SECRET), no mesmo padrão
// de send-scheduled-report. Lembre de registrar verify_jwt = false para esta função
// em supabase/config.toml antes do deploy.
//
// REGRA GERAL DE STATUS: fora do 401/400, esta função responde sempre 200. O trigger
// é fire-and-forget e roda dentro da transação de finalização do chamado; um 5xx aqui
// só polui log de pg_net e passa a impressão de que a finalização falhou, quando na
// verdade o chamado foi fechado normalmente e apenas o e-mail não saiu.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface AvaliacaoEmailRequest {
  ticket_id: string;
}

// Comparação em tempo constante: um `===` de string sai no primeiro caractere
// diferente, o que deixa o segredo adivinhável byte a byte por timing. Aqui todo o
// conteúdo é sempre percorrido; o tamanho é misturado no acumulador para não abrir
// caminho de diferenciação por comprimento.
function segredosIguais(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  let diferenca = bytesA.length ^ bytesB.length;
  const tamanho = Math.max(bytesA.length, bytesB.length);
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diferenca === 0;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cronSecret = Deno.env.get('CRON_DISPATCH_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || !providedSecret || !segredosIguais(providedSecret, cronSecret)) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AvaliacaoEmailRequest = await req.json();
    const ticketId = body?.ticket_id;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'ticket_id ausente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, title, user_id, status')
      .eq('id', ticketId)
      .maybeSingle();

    // Chamado inexistente (ou já removido entre o trigger e a execução) não é erro
    // desta função — responde 200 explicando o motivo, sem enviar e-mail.
    if (ticketError || !ticket) {
      console.error('Chamado não encontrado para avaliação:', ticketId, ticketError);
      return new Response(
        JSON.stringify({ sent: false, reason: 'Chamado não encontrado; e-mail de avaliação não enviado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', ticket.user_id)
      .maybeSingle();

    const destinatario = profile?.email ?? null;

    if (!destinatario) {
      console.log('Solicitante sem e-mail cadastrado; nada a enviar. Chamado:', ticket.ticket_number);
      return new Response(
        JSON.stringify({ sent: false, reason: 'Solicitante sem e-mail cadastrado; e-mail de avaliação não enviado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Contas machine-%@orion.internal são as contas-fantasma que o agente Windows usa
    // para identificar a máquina. Não existe pessoa atrás desse endereço e o domínio
    // nem é roteável, então mandar e-mail só geraria bounce na reputação do domínio.
    if (/^machine-.*@orion\.internal$/i.test(destinatario)) {
      console.log('Solicitante é conta de máquina; e-mail de avaliação ignorado. Chamado:', ticket.ticket_number);
      return new Response(
        JSON.stringify({ sent: false, reason: 'Solicitante é conta de máquina do agente; e-mail de avaliação não enviado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Sem chave do Resend o e-mail simplesmente não sai; ainda assim 200, porque o
    // chamado foi finalizado com sucesso e a avaliação continua disponível no app.
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY não configurada');
      return new Response(
        JSON.stringify({ sent: false, reason: 'Serviço de e-mail não configurado; e-mail de avaliação não enviado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nome = profile?.full_name || 'Olá';
    const avaliacaoUrl = `https://orion.bysam.dev/avaliacao/${ticket.id}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Avalie o atendimento</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Orion System</h1>
          </div>

          <!-- Body -->
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
              ${nome}, seu chamado foi finalizado!
            </h2>

            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
              O chamado <strong>#${ticket.ticket_number}</strong> &mdash; ${ticket.title} &mdash; foi concluído.
              Conte para a gente como foi o atendimento: leva menos de um minuto.
            </p>

            <!-- Botão de avaliação -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${avaliacaoUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                Avaliar atendimento
              </a>
            </div>

            <p style="margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px; line-height: 1.6;">
              Se o botão não funcionar, copie e cole este endereço no navegador:<br>
              <a href="${avaliacaoUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">${avaliacaoUrl}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f7fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #a0aec0; font-size: 12px;">
              © ${new Date().getFullYear()} Orion System. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Só o id interessa: é ele que prova que o Resend aceitou o envio.
    let emailData: { id?: string } | null = null;
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Orion System <orionsystem@bysam.dev>',
          to: [destinatario],
          subject: `Chamado #${ticket.ticket_number} finalizado - avalie o atendimento`,
          html: emailHtml,
        }),
      });

      if (emailResponse.ok) {
        emailData = await emailResponse.json();
        console.log('E-mail de avaliação enviado com sucesso. ID:', emailData?.id);
      } else {
        const errorData = await emailResponse.text();
        console.error('Erro ao enviar e-mail via Resend:', errorData);
      }
    } catch (e) {
      console.error('Erro na requisição Resend:', e);
    }

    return new Response(
      JSON.stringify({
        sent: Boolean(emailData?.id),
        reason: emailData?.id
          ? `E-mail de avaliação enviado para ${destinatario}`
          : 'Não foi possível enviar o e-mail de avaliação agora; o chamado foi finalizado normalmente.',
        ticket_id: ticket.id,
        email_id: emailData?.id || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    // Até erro inesperado sai como 200: ver a "REGRA GERAL DE STATUS" no topo.
    console.error('Erro geral no envio de avaliação:', error);
    return new Response(
      JSON.stringify({
        sent: false,
        reason: (error instanceof Error && error.message) || 'Erro interno ao preparar o e-mail de avaliação.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
