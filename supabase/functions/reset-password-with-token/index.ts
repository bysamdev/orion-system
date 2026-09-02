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

// Esta função é anônima por natureza: quem redefine a senha ainda não
// consegue autenticar. O que a protege é o token (UUID v4 de gerador
// criptográfico, com expiração e remoção após uso) — não um JWT. Por isso
// o rate limit aqui não é conforto, é a única barreira contra alguém
// martelar o endpoint de graça.
//
// Reusa public.check_rate_limit (mesma primitiva do backend Go em
// lib/ratelimit.go, contador de janela fixa em rate_limit_counters), em vez
// de um mecanismo próprio: o limite passa a valer entre todas as instâncias
// da função, não por processo.
const LIMITE_POR_IP = 10;      // varredura de tokens a partir de um mesmo lugar
const LIMITE_POR_TOKEN = 5;    // insistência num token específico
const JANELA_SEGUNDOS = 15 * 60;

// Resposta única para todo caminho de falha de validação. Token inexistente,
// token expirado e usuário ausente devolvem exatamente esta mensagem: qualquer
// diferença entre elas conta ao chamador se aquele token um dia existiu.
const ERRO_GENERICO = 'Token inválido ou expirado';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

// Primeiro IP do X-Forwarded-For (o mais à esquerda é o cliente; os demais
// são proxies). Sem header, cai num balde único — pior isolamento, mas ainda
// limita o volume total.
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const primeiro = xff.split(',')[0].trim();
    if (primeiro) return primeiro;
  }
  return req.headers.get('cf-connecting-ip') ?? 'sem-ip';
}

function respostaErro(status = 400, mensagem = ERRO_GENERICO) {
  return new Response(
    JSON.stringify({ error: mensagem }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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

    // Validação de input. Estes dois erros podem ser específicos: falam do
    // que o próprio chamador enviou, não da existência de um token alheio.
    if (!token || !newPassword) {
      return respostaErro(400, 'Token e nova senha são obrigatórios');
    }

    if (newPassword.length < 6) {
      return respostaErro(400, 'A senha deve ter no mínimo 6 caracteres');
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

    console.log('=== Passo 0: Rate limit ===');

    // Antes de tocar no banco de tokens. Os dois baldes são checados sempre,
    // sem short-circuit, pra que uma tentativa bloqueada por IP ainda conte
    // no balde do token — senão o atacante contornaria o limite por token
    // simplesmente trocando de origem.
    const ip = clientIp(req);
    const [limiteIp, limiteToken] = await Promise.all([
      supabaseAdmin.rpc('check_rate_limit', {
        p_key: `reset-password:ip:${ip}`,
        p_window_seconds: JANELA_SEGUNDOS,
        p_limit: LIMITE_POR_IP,
      }),
      supabaseAdmin.rpc('check_rate_limit', {
        p_key: `reset-password:token:${token}`,
        p_window_seconds: JANELA_SEGUNDOS,
        p_limit: LIMITE_POR_TOKEN,
      }),
    ]);

    // Erro na checagem NÃO libera a passagem: sem o contador não há barreira
    // nenhuma, e este endpoint troca senha.
    if (limiteIp.error || limiteToken.error) {
      console.error('Erro ao checar rate limit:', limiteIp.error ?? limiteToken.error);
      return respostaErro(503, 'Serviço temporariamente indisponível. Tente novamente em instantes.');
    }

    const excedeuIp = (limiteIp.data as number) > LIMITE_POR_IP;
    const excedeuToken = (limiteToken.data as number) > LIMITE_POR_TOKEN;

    if (excedeuIp || excedeuToken) {
      console.warn(`Rate limit excedido (ip=${excedeuIp}, token=${excedeuToken})`);
      return new Response(
        JSON.stringify({
          error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(JANELA_SEGUNDOS) },
        }
      );
    }

    console.log('=== Passo 1: Validando token ===');

    // Buscar token na tabela invite_tokens
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('email, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('Erro ao buscar token:', tokenError);
      return respostaErro(500, 'Erro ao validar token');
    }

    if (!tokenData) {
      console.log('Token não encontrado');
      return respostaErro();
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

      return respostaErro();
    }

    console.log('Token válido para email:', maskEmail(tokenData.email));

    console.log('=== Passo 2: Buscando usuário pelo email ===');

    // Busca direta em profiles.email (índice único), em vez de
    // auth.admin.listUsers(). O listUsers carregava a base INTEIRA de
    // usuários e filtrava em memória a cada tentativa — uma consulta que
    // cresce com o número de usuários, disparável por qualquer anônimo.
    // profiles.id é o mesmo uuid de auth.users.id.
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', tokenData.email)
      .maybeSingle();

    if (perfilError) {
      console.error('Erro ao buscar perfil:', perfilError);
      return respostaErro(500, 'Erro ao buscar usuário');
    }

    if (!perfil) {
      // Token válido apontando pra usuário inexistente é inconsistência de
      // dados, não input do chamador — mas a resposta é a mesma de token
      // inválido, pra não confirmar que o token existia.
      console.error('Usuário não encontrado para email:', maskEmail(tokenData.email));
      return respostaErro();
    }

    console.log('Usuário encontrado. ID:', perfil.id);

    console.log('=== Passo 3: Atualizando senha do usuário ===');

    // Atualizar senha do usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      perfil.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return respostaErro(500, 'Erro ao atualizar senha');
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
    return respostaErro(400, 'Erro interno ao processar reset de senha');
  }
});
