import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tamanho mínimo da senha que a pessoa cria para si: mais que os 6 aceitos na
// senha temporária do gestor, porque esta é a senha que fica.
const SENHA_MINIMA = 8;

const responder = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Troca a senha provisória (a do e-mail de boas-vindas ou a temporária
 * definida pelo gestor) pela senha que a própria pessoa escolheu, e desliga a
 * obrigação de troca (app_metadata.deve_trocar_senha). Só age sobre a conta de
 * quem chama: o alvo é sempre o usuário da sessão.
 *
 * Portada da rota Go /api/functions/trocar-senha-provisoria (ORN-DUP-02):
 * em produção o frontend usa só as Edge, e esta faltava — a troca obrigatória
 * de senha não funcionava (ORN-INC-02).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return responder(401, { error: 'Autenticação necessária' });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return responder(401, { error: 'Autenticação necessária' });
    }

    const corpo = await req.json().catch(() => null);
    const senha = typeof corpo?.newPassword === 'string' ? corpo.newPassword : '';
    if (senha.length < SENHA_MINIMA) {
      return responder(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
    }
    if (senha.trim() !== senha) {
      return responder(400, { error: 'A senha não pode começar nem terminar com espaço.' });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: senha,
      app_metadata: { deve_trocar_senha: false },
    });
    if (error) {
      console.error('Erro ao trocar senha provisória:', error.message);
      return responder(400, { error: 'Não foi possível salvar a nova senha' });
    }

    return responder(200, { success: true });
  } catch (e) {
    console.error('Erro inesperado:', e);
    return responder(500, { error: 'Erro interno' });
  }
});
