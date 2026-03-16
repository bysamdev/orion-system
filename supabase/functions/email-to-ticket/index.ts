import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
  } catch (error) {
    console.error('Error processing email:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
