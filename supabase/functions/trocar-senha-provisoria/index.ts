import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { validarNovaSenha } from "../_shared/regras-de-usuario.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const senha = corpo?.newPassword;
    const erroNaSenha = validarNovaSenha(senha);
    if (erroNaSenha) return responder(400, { error: erroNaSenha });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: senha as string,
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
