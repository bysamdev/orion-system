import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// O destinatário é SEMPRE o e-mail da sessão (ORN-SEC-10): antes, email e
// full_name vinham do corpo, e qualquer usuário logado mandava e-mail com o
// remetente do Orion para qualquer endereço, com HTML injetado no nome.
const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Um alerta por troca de senha basta; mais que isso por hora é abuso.
const LIMITE_POR_HORA = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Enviando alerta de alteração de senha ===');

    // Autenticar requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const email = user.email;
    if (!email) {
      throw new Error('Usuário sem e-mail');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: tentativas, error: limiteError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `password-changed-alert:${user.id}`,
      p_window_seconds: 3600,
      p_limit: LIMITE_POR_HORA,
    });
    if (limiteError) {
      throw new Error('Erro ao verificar limite de envio');
    }
    if ((tentativas ?? 0) > LIMITE_POR_HORA) {
      return new Response(
        JSON.stringify({ error: 'Limite de alertas atingido. Tente mais tarde.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const nome = escaparHtml(perfil?.full_name || 'Usuário');

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY não configurada');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerta de Segurança - Orion System</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🔐 Alerta de Segurança</h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
              Olá, ${nome}!
            </h2>
            
            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
              Sua senha no <strong>Orion System</strong> foi alterada com sucesso.
            </p>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                <strong>⚠️ Se você não fez essa alteração</strong>, entre em contato imediatamente com o suporte para proteger sua conta.
              </p>
            </div>
            
            <p style="margin: 20px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
              Data e hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Orion System <orionsystem@bysam.dev>',
        to: [email],
        subject: '🔐 Alerta: Sua senha foi alterada - Orion System',
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Erro ao enviar e-mail:', errorData);
      throw new Error('Erro ao enviar alerta');
    }

    const emailData = await emailResponse.json();
    console.log('Alerta enviado com sucesso:', emailData?.id);

    return new Response(
      JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
