import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MergeUsersRequest {
  source_user_id: string;
  target_user_id: string;
}

// merge-users — junta os dados de um usuário-fantasma criado pelo agente
// (machine-login, ver handler/auth_handlers.go no backend Go) com um
// usuário real de login. source desaparece (dados movidos, depois
// excluído); target permanece.
//
// Espelha delete-user-admin/index.ts no padrão de auth/tenancy (SEC-02) —
// o backend Go já tem um endpoint equivalente (POST /api/functions/merge-users),
// mas invokeOrionFunction cai pra Edge Function quando VITE_API_URL não está
// configurado (ver src/lib/orion-functions.ts), então sem esta função o
// botão "Mesclar" no painel falhava com "Failed to send a request to the
// Edge Function" — a rota Go nunca era alcançada.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id);

    if (roleError || !userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasPermission = userRoles.some(r => ['admin', 'developer'].includes(r.role));
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem mesclar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { source_user_id, target_user_id }: MergeUsersRequest = await req.json();

    if (!source_user_id || !target_user_id) {
      return new Response(
        JSON.stringify({ error: 'source_user_id e target_user_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (source_user_id === target_user_id) {
      return new Response(
        JSON.stringify({ error: 'source e target não podem ser o mesmo usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (source_user_id === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode mesclar sua própria conta como origem' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sourceUser, error: sourceError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, company_id')
      .eq('id', source_user_id)
      .single();
    if (sourceError || !sourceUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário de origem não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', target_user_id)
      .single();
    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário de destino não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SEC-02: admin de tenant só mescla usuários da própria empresa — checa
    // os DOIS lados (source e target), não só o que some.
    const { data: isGlobalScope, error: globalScopeError } = await supabaseAdmin
      .rpc('is_master_company_user', { _user_id: requestingUser.id });
    if (globalScopeError) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível verificar permissões do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isGlobalScope) {
      const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', requestingUser.id)
        .single();

      const callerCompanyId = callerProfile?.company_id;
      if (
        callerProfileError || !callerCompanyId ||
        sourceUser.company_id !== callerCompanyId ||
        targetUser.company_id !== callerCompanyId
      ) {
        return new Response(
          JSON.stringify({ error: 'Usuário de origem ou destino não pertence à sua empresa' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { error: mergeError } = await supabaseAdmin.rpc('merge_user_data', {
      source_id: source_user_id,
      target_id: target_user_id,
    });
    if (mergeError) {
      return new Response(
        JSON.stringify({ error: `Erro ao mesclar dados: ${mergeError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Best-effort: os dados já foram movidos com sucesso nesse ponto, então
    // uma falha aqui não deve parecer que o merge inteiro falhou — o admin
    // pode excluir o usuário órfão manualmente depois pela mesma tela.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(source_user_id);
    if (deleteError) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dados mesclados, mas não foi possível remover o usuário de origem automaticamente — exclua-o manualmente.',
          warning: deleteError.message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuários mesclados com sucesso',
        merged_source: { id: source_user_id, email: sourceUser.email },
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
