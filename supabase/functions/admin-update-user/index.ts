import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, email, password, full_name, department, role } = await req.json();

    console.log('Admin update user request for:', user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente admin com Service Role
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

    // 1. Atualizar dados no Auth (email e/ou senha)
    const authUpdateData: { email?: string; password?: string } = {};
    
    if (email) {
      authUpdateData.email = email;
    }
    
    // Só processar senha se foi fornecida e não é string vazia
    const hasNewPassword = password && typeof password === 'string' && password.trim().length > 0;
    
    if (hasNewPassword) {
      if (password.trim().length < 6) {
        return new Response(
          JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authUpdateData.password = password.trim();
    }

    if (Object.keys(authUpdateData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        authUpdateData
      );

      if (authError) {
        console.error('Erro ao atualizar Auth:', authError);
        return new Response(
          JSON.stringify({ error: `Erro ao atualizar autenticação: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Auth atualizado com sucesso');
    }

    // 2. Atualizar profile (full_name, department, email)
    const profileUpdateData: { full_name?: string; department?: string | null; email?: string } = {};
    
    if (full_name) {
      profileUpdateData.full_name = full_name.trim();
    }
    
    if (department !== undefined) {
      profileUpdateData.department = department?.trim() || null;
    }

    if (email) {
      profileUpdateData.email = email.trim();
    }

    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', user_id);

      if (profileError) {
        console.error('Erro ao atualizar profile:', profileError);
        return new Response(
          JSON.stringify({ error: `Erro ao atualizar perfil: ${profileError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Profile atualizado com sucesso');
    }

    // 3. Atualizar role
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id);

      if (roleError) {
        console.error('Erro ao atualizar role:', roleError);
        return new Response(
          JSON.stringify({ error: `Erro ao atualizar função: ${roleError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Role atualizado com sucesso');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário atualizado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro na função admin-update-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
