import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  message?: string;
}

/**
 * Edge Function para verificar rate limiting na criação de tickets
 * Previne spam e ataques de bot
 * 
 * Limites:
 * - 1 ticket a cada 2 minutos por usuário
 * - Máximo de 10 tickets por hora por usuário
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter token de autenticação do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar usuário autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Autenticação inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Checking rate limit for user: ${userId}`);

    // Verificar tickets criados nas últimas 2 horas
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentTickets, error: ticketError } = await supabase
      .from('tickets')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false });

    if (ticketError) {
      console.error('Error fetching tickets:', ticketError);
      throw new Error('Erro ao verificar histórico de tickets');
    }

    console.log(`Found ${recentTickets?.length || 0} recent tickets`);

    const now = Date.now();
    const twoMinutesInMs = 2 * 60 * 1000;
    const oneHourInMs = 60 * 60 * 1000;

    // Verificar último ticket (cooldown de 2 minutos)
    if (recentTickets && recentTickets.length > 0) {
      const lastTicketTime = new Date(recentTickets[0].created_at).getTime();
      const timeSinceLastTicket = now - lastTicketTime;

      if (timeSinceLastTicket < twoMinutesInMs) {
        const remainingSeconds = Math.ceil((twoMinutesInMs - timeSinceLastTicket) / 1000);
        const resetAt = new Date(lastTicketTime + twoMinutesInMs).toISOString();

        const response: RateLimitCheck = {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Aguarde ${remainingSeconds} segundos antes de abrir outro chamado`,
        };

        console.log('Rate limit exceeded (cooldown):', response);

        return new Response(
          JSON.stringify(response),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verificar limite de tickets por hora (máximo 10)
    const oneHourAgo = new Date(now - oneHourInMs).toISOString();
    const ticketsLastHour = recentTickets?.filter(
      (ticket) => new Date(ticket.created_at).getTime() > (now - oneHourInMs)
    ) || [];

    const maxTicketsPerHour = 10;
    if (ticketsLastHour.length >= maxTicketsPerHour) {
      const oldestTicketInWindow = ticketsLastHour[ticketsLastHour.length - 1];
      const resetAt = new Date(new Date(oldestTicketInWindow.created_at).getTime() + oneHourInMs).toISOString();

      const response: RateLimitCheck = {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Limite de ${maxTicketsPerHour} chamados por hora atingido. Tente novamente mais tarde`,
      };

      console.log('Rate limit exceeded (hourly limit):', response);

      return new Response(
        JSON.stringify(response),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permitido - retornar informações de limite
    const remaining = maxTicketsPerHour - ticketsLastHour.length - 1; // -1 porque vai criar mais um
    const resetAt = new Date(now + oneHourInMs).toISOString();

    const response: RateLimitCheck = {
      allowed: true,
      remaining,
      resetAt,
    };

    console.log('Rate limit check passed:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-rate-limit:', error);
    
    // SECURITY: Fail closed - negar acesso em caso de erro do sistema
    return new Response(
      JSON.stringify({ 
        error: 'Sistema de proteção temporariamente indisponível. Tente novamente em alguns instantes.',
        allowed: false, // Fallback seguro: negar em caso de erro
        remaining: 0,
        resetAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
