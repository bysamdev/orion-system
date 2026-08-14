import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = new TextEncoder().encode(provided)
  const b = new TextEncoder().encode(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // SEC-03: esta função é pública (provedores de email como SendGrid/Mailgun/
  // Postmark não enviam JWT do Supabase), então sem um segredo compartilhado
  // qualquer requisição HTTP externa cria chamados forjados em nome de
  // qualquer cliente. Falha FECHADO: sem a variável configurada, o endpoint
  // fica indisponível em vez de aceitar tudo (mesmo padrão do CRON_SECRET).
  const expectedSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  if (!expectedSecret) {
    console.error('[ALERTA] email-to-ticket chamado mas EMAIL_WEBHOOK_SECRET não está configurada — recusando por segurança')
    return new Response(JSON.stringify({ error: 'Webhook não configurado' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const providedSecret = req.headers.get('X-Webhook-Secret') ?? ''
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    console.error('email-to-ticket: X-Webhook-Secret ausente ou inválido')
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Received Email Payload:', payload)

    // Parsing logic for common providers (SendGrid, Mailgun, etc.)
    // Expecting: subject, from, text/html
    const { from, subject, text, html } = payload

    // 1. Find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, full_name')
      .eq('email', from)
      .single()

    if (!profile) {
      console.log('User not found for email:', from)
      // Optional: Auto-create user or send "Account Not Found" email
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }

    // 2. Create Ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        title: subject || 'Ticket via Email',
        description: text || html || 'Sem conteúdo',
        requester_name: profile.full_name,
        user_id: profile.id,
        company_id: profile.company_id,
        status: 'open',
        category: 'Suporte Geral',
        priority: 'medium'
      })
      .select()
      .single()

    if (ticketError) throw ticketError

    console.log('Ticket created successfully:', ticket.id)

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticket.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error processing email:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'Error processing email' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
