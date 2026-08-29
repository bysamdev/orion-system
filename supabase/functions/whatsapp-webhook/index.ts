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
    const expectedSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'Webhook não configurado' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const providedSecret = req.headers.get('X-Webhook-Secret') ?? '';
    if (providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // WhatsApp provider payload (e.g., Twilio or Meta Graph API)
    const payload = await req.json()
    const phoneMasked = payload?.From ? String(payload.From).slice(0, 5) + '****' + String(payload.From).slice(-2) : 'unknown'
    console.log('Received WhatsApp Webhook event from:', phoneMasked)

    // Simplified logic for a Twilio-like request
    const from = payload.From?.replace('whatsapp:', '')
    const body = payload.Body

    // 1. Find user by phone (if available in profile) or fallback
    // For now, we might need a phone field in profiles. 
    // Let's assume we search by a custom field or just log it.
    
    // 2. Create Ticket or append to existing
    // Logic here would likely involve checking for an active ticket from this user
    
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Webhook Error:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'Webhook Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
