import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  department: string | null;
  role: 'customer' | 'technician' | 'admin';
  company_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente com service role para criar usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Verificar se o usuário atual é admin ou developer
    const { data: { user: currentUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !currentUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar role do usuário atual
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasPermission = userRoles?.some(r => ['admin', 'developer'].includes(r.role));
    if (!hasPermission) {
      console.error('User does not have permission. Roles:', userRoles);
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    console.log('Creating user with data:', { ...body, password: '[REDACTED]' });

    // Validações
    if (!body.email || !body.password || !body.full_name || !body.company_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validRoles = ['customer', 'technician', 'admin'];
    if (!validRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ error: 'Função inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Criar usuário no Auth
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Confirma o email automaticamente
      user_metadata: {
        full_name: body.full_name,
      }
    });

    if (createAuthError) {
      console.error('Create auth user error:', createAuthError);
      let errorMessage = 'Erro ao criar usuário';
      if (createAuthError.message.includes('already registered')) {
        errorMessage = 'Este email já está cadastrado';
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user.id;
    console.log('User created in auth with ID:', newUserId);

    // 2. Atualizar o profile (trigger já cria, mas precisamos atualizar company_id e department)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: body.company_id,
        department: body.department,
      })
      .eq('id', newUserId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Se falhar, deletar o usuário criado
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Atualizar a role (trigger já cria como 'customer', precisamos atualizar se for diferente)
    if (body.role !== 'customer') {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: body.role })
        .eq('user_id', newUserId);

      if (roleUpdateError) {
        console.error('Role update error:', roleUpdateError);
        // Não é crítico, continuar
      }
    }

    console.log('User created successfully:', newUserId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: 'Usuário criado com sucesso' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
