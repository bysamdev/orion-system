import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteUserRequest {
  email: string;
  full_name: string;
  department: string | null;
  role: 'customer' | 'technician' | 'admin';
  company_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Iniciando invite-user-resend ===');

    // Autenticar requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Cabeçalho de autorização ausente');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      throw new Error('Não autorizado');
    }

    console.log('Usuário autenticado:', user.id);

    // Verificar role do solicitante (admin ou developer)
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) {
      console.error('Erro ao buscar role:', roleError);
      throw new Error('Não foi possível verificar permissões');
    }

    if (roleData.role !== 'admin' && roleData.role !== 'developer') {
      throw new Error('Apenas administradores podem convidar usuários');
    }

    console.log('Role verificada:', roleData.role);

    // Parse do body
    const body: InviteUserRequest = await req.json();
    console.log('Dados recebidos:', { ...body, email: '***' });

    const { email, full_name, department, role, company_id } = body;

    // Validação de input
    if (!email || !full_name || !role || !company_id) {
      throw new Error('Dados obrigatórios ausentes: email, full_name, role, company_id');
    }

    // Cliente admin do Supabase (ignora RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('=== Passo A: Gerando link de convite ===');

    // Passo A: Gerar link de convite (sem enviar e-mail padrão do Supabase)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        data: {
          full_name: full_name,
        },
        redirectTo: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com')}/definir-senha`,
      },
    });

    if (inviteError || !inviteData.user) {
      console.error('Erro ao gerar link de convite:', inviteError);
      throw new Error(`Erro ao gerar convite: ${inviteError?.message || 'Desconhecido'}`);
    }

    const userId = inviteData.user.id;
    const actionLink = inviteData.properties.action_link;

    console.log('Link gerado com sucesso. User ID:', userId);
    console.log('Action link:', actionLink);

    // Passo B: Atualizar perfil nas tabelas profiles e user_roles
    console.log('=== Passo B: Atualizando perfil do usuário ===');

    // Aguardar um momento para o trigger handle_new_user completar
    await new Promise(resolve => setTimeout(resolve, 500));

    // Atualizar na tabela profiles (o trigger já criou com company padrão)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: full_name,
        department: department,
        company_id: company_id,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Erro ao atualizar profile:', profileError);
      throw new Error(`Erro ao atualizar perfil: ${profileError.message}`);
    }

    console.log('Profile atualizado com sucesso');

    // Atualizar na tabela user_roles (o trigger já criou com role 'customer')
    if (role !== 'customer') {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', userId);

      if (roleUpdateError) {
        console.error('Erro ao definir role:', roleUpdateError);
        throw new Error(`Erro ao definir função: ${roleUpdateError.message}`);
      }

      console.log('Role atualizada para:', role);
    } else {
      console.log('Role padrão mantida: customer');
    }

    // Passo C: Enviar e-mail via Resend
    console.log('=== Passo C: Enviando e-mail via Resend ===');

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
        <title>Convite - Orion System</title>
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
              Olá, ${full_name}!
            </h2>
            
            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
              Você foi convidado para acessar o <strong>Orion System</strong>, nossa plataforma de gestão de chamados e suporte.
            </p>
            
            <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
              Para começar a utilizar o sistema, clique no botão abaixo e defina sua senha de acesso:
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionLink}" 
                 style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                Definir Minha Senha
              </a>
            </div>
            
            <p style="margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px; line-height: 1.6;">
              Se você não solicitou este convite, pode ignorar este e-mail com segurança.
            </p>
            
            <p style="margin: 15px 0 0 0; color: #a0aec0; font-size: 12px; line-height: 1.6;">
              <strong>Importante:</strong> Este link é válido por 24 horas. Após esse período, será necessário solicitar um novo convite.
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
        subject: 'Convite: Acesse o Orion System',
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Erro ao enviar e-mail via Resend:', errorData);
      throw new Error(`Erro ao enviar e-mail: ${emailResponse.statusText}`);
    }

    const emailData = await emailResponse.json();

    console.log('E-mail enviado com sucesso. ID:', emailData?.id);
    console.log('=== Processo concluído com sucesso ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Convite enviado para ${email} com sucesso`,
        user_id: userId,
        email_id: emailData?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro interno ao processar convite',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
