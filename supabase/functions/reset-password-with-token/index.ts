import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Iniciando reset-password-with-token ===');

    // Parse do body
    const body: ResetPasswordRequest = await req.json();
    console.log('Dados recebidos (token omitido por segurança)');

    const { token, newPassword } = body;

    // Validação de input
    if (!token || !newPassword) {
      throw new Error('Token e nova senha são obrigatórios');
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres');
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

    console.log('=== Passo 1: Validando token ===');

    // Buscar token na tabela invite_tokens
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('email, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('Erro ao buscar token:', tokenError);
      throw new Error('Erro ao validar token');
    }

    if (!tokenData) {
      console.log('Token não encontrado');
      throw new Error('Token inválido ou expirado');
    }

    // Verificar se token não expirou
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log('Token expirado');
      // Deletar token expirado
      await supabaseAdmin
        .from('invite_tokens')
        .delete()
        .eq('token', token);
      
      throw new Error('Token expirado');
    }

    console.log('Token válido para email:', tokenData.email);

    console.log('=== Passo 2: Buscando usuário pelo email ===');

    // Buscar usuário pelo email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Erro ao listar usuários:', listError);
      throw new Error('Erro ao buscar usuário');
    }

    const user = users.find(u => u.email === tokenData.email);

    if (!user) {
      console.error('Usuário não encontrado para email:', tokenData.email);
      throw new Error('Usuário não encontrado');
    }

    console.log('Usuário encontrado. ID:', user.id);

    console.log('=== Passo 3: Atualizando senha do usuário ===');

    // Atualizar senha do usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      throw new Error(`Erro ao atualizar senha: ${updateError.message}`);
    }

    console.log('Senha atualizada com sucesso');

    console.log('=== Passo 4: Deletando token usado ===');

    // Deletar token para que não possa ser reutilizado
    const { error: deleteError } = await supabaseAdmin
      .from('invite_tokens')
      .delete()
      .eq('token', token);

    if (deleteError) {
      console.error('Aviso: Erro ao deletar token:', deleteError);
      // Não falhar a operação por isso
    } else {
      console.log('Token deletado com sucesso');
    }

    console.log('=== Processo concluído com sucesso ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha definida com sucesso',
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
        error: error.message || 'Erro interno ao processar reset de senha',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
