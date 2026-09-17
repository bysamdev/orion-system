import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

// Conta-fantasma do agente Windows (lib.MachineGhostEmail). Mesmo teste que
// send-avaliacao-email usa e mesma ideia do LIKE em eh_usuario_de_maquina: não
// existe pessoa atrás desse endereço, e desde a migration 20260916210000 ela não
// abre chamado nenhum. Aqui a checagem é por e-mail e não pelo id porque o que o
// webhook traz é justamente um endereço — e o domínio orion.internal nem é
// roteável, então nenhum e-mail legítimo pode chegar dele.
const RE_CONTA_DE_MAQUINA = /^machine-.*@orion\.internal$/i

// Janela da regra de avaliação obrigatória (migration 20260916230000): chamado
// encerrado há mais de 30 dias deixa de bloquear. Replicada aqui como número
// porque service_role não pode chamar tem_avaliacao_pendente() — ela lê
// auth.uid() por dentro, que é NULL nesse contexto e devolveria "sem pendência"
// silenciosamente, ou seja, a função falharia ABERTO justamente na regra que
// estamos tentando fechar.
const JANELA_AVALIACAO_DIAS = 30

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
    const maskedFrom = payload?.from ? String(payload.from).replace(/(.{2})(.*)(@.*)/, '$1***$3') : '[unknown]'
    console.log('Received Email Webhook for processing from:', maskedFrom)

    // Parsing logic for common providers (SendGrid, Mailgun, etc.)
    // Expecting: subject, from, text/html
    const { from, subject, text, html } = payload

    // Normaliza antes de buscar: provedores de e-mail entregam o remetente com
    // caixa e espaços do cliente de origem ("  Fulano@Empresa.COM "), e o
    // .eq() é case-sensitive — sem isso o mesmo endereço ora acha o perfil, ora
    // não, e a regra de quem pode abrir chamado vira sorteio.
    const remetente = typeof from === 'string' ? from.trim().toLowerCase() : ''

    // 1. Find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, email')
      .eq('email', remetente)
      .maybeSingle()

    // Perfil inexistente: 404 porque o solicitante simplesmente não existe aqui.
    // O provedor não deve reentregar — reentrega não faz o cadastro aparecer.
    if (!profile) {
      console.log('User not found for email:', maskedFrom)
      // Optional: Auto-create user or send "Account Not Found" email
      return new Response(
        JSON.stringify({ error: 'Remetente sem cadastro no Orion', motivo: 'perfil_inexistente' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Conta de máquina: 403 e não 404 — o endereço existe, mas é proibido abrir
    // chamado por ele. Separar os dois códigos é o que permite distinguir no log
    // "ninguém com esse e-mail" de "alguém tentou usar o fantasma do agente".
    if (RE_CONTA_DE_MAQUINA.test(String(profile.email ?? remetente))) {
      console.warn('email-to-ticket: tentativa de abertura por conta de máquina:', maskedFrom)
      return new Response(
        JSON.stringify({ error: 'Conta de máquina não abre chamado', motivo: 'conta_de_maquina' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1b. Avaliação pendente
    //
    // Chamado vindo de e-mail é chamado de PESSOA, então vale a mesma regra da
    // policy de INSERT (migration 20260916230000). Como service_role ignora RLS
    // e as funções SQL da regra leem auth.uid(), a decisão é reproduzida aqui
    // consultando as tabelas — com as MESMAS cinco exclusões, na mesma ordem.
    //
    // A policy também isenta a equipe interna (admin/technician/developer), e a
    // isenção precisa valer aqui: senão o mesmo técnico que abre chamado pela
    // tela sem obstáculo é barrado ao abrir por e-mail — a regra passaria a
    // depender do canal, não de quem é a pessoa.
    const { data: papeis, error: papeisError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)

    if (papeisError) throw papeisError

    const ehEquipeInterna = (papeis ?? []).some((p: { role: string }) =>
      p.role === 'admin' || p.role === 'technician' || p.role === 'developer'
    )

    // O filtro por janela vem antes de escolher o último encerrado de propósito:
    // PostgREST não ordena por COALESCE(closed_at, resolved_at), então recortar
    // os últimos 30 dias (quem está fora da janela não bloqueia ninguém, por
    // definição) reduz a lista a um punhado de linhas e o "último" é calculado
    // em memória. Se nada cai na janela, também não há o que avaliar.
    const corteDaJanela = new Date(Date.now() - JANELA_AVALIACAO_DIAS * 24 * 60 * 60 * 1000).toISOString()

    let encerrados: any[] = []

    if (!ehEquipeInterna) {
      const { data, error: encerradosError } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, closed_at, resolved_at, metadata')
        .eq('user_id', profile.id)
        // 'cancelled' fica de fora: não houve atendimento a avaliar.
        .in('status', ['resolved', 'closed'])
        .or(`closed_at.gte.${corteDaJanela},resolved_at.gte.${corteDaJanela}`)

      // Falha de leitura NÃO libera a abertura: a regra é de bloqueio, e tratar
      // erro como "sem pendência" seria a mesma porta dos fundos de novo, só que
      // acionável por indisponibilidade do banco. Sobe para o catch (400).
      if (encerradosError) throw encerradosError

      encerrados = data ?? []
    }

    const comDataDeEncerramento = (t: any) => {
      const encerradoEm = t.closed_at ?? t.resolved_at
      return encerradoEm ? { ...t, encerrado_em: encerradoEm } : null
    }

    const candidatos = (encerrados ?? [])
      .map(comDataDeEncerramento)
      .filter((t): t is any => t !== null)
      .sort((a, b) => (a.encerrado_em < b.encerrado_em ? 1 : -1))

    // Só o ÚLTIMO encerrado importa: se ele já foi avaliado, não bloqueia, mesmo
    // que exista um mais antigo sem avaliação.
    const ultimoEncerrado = candidatos[0] ?? null

    if (ultimoEncerrado) {
      const mesclado = String(ultimoEncerrado.metadata?.merged_into ?? '') !== ''
      const fechadoPorInatividade = String(ultimoEncerrado.metadata?.fechado_por_inatividade ?? '') === 'true'

      if (!mesclado && !fechadoPorInatividade) {
        // Qualquer linha em ticket_ratings resolve a pendência, inclusive as
        // antigas com skipped = true (o "pular" existiu e não se pune ninguém
        // retroativamente).
        const { data: avaliacao, error: avaliacaoError } = await supabase
          .from('ticket_ratings')
          .select('id')
          .eq('ticket_id', ultimoEncerrado.id)
          .limit(1)
          .maybeSingle()

        if (avaliacaoError) throw avaliacaoError

        if (!avaliacao) {
          // 409 (Conflito): o pedido está bem formado e autenticado; o que
          // impede é o ESTADO atual do solicitante, que só ele resolve avaliando
          // o chamado anterior. Não é 403 (que aqui significa "essa identidade
          // nunca abre chamado") nem 422 (o corpo do e-mail está correto).
          console.log('email-to-ticket: avaliação pendente do chamado', ultimoEncerrado.ticket_number, 'para', maskedFrom)
          return new Response(
            JSON.stringify({
              error: 'Avaliação pendente do último chamado encerrado',
              motivo: 'avaliacao_pendente',
              chamado_pendente: {
                ticket_number: ultimoEncerrado.ticket_number,
                title: ultimoEncerrado.title,
                encerrado_em: ultimoEncerrado.encerrado_em,
              },
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // 2. Create Ticket
    // user_id e company_id saem SEMPRE do perfil encontrado pelo remetente,
    // nunca do corpo da requisição — é o que a policy garante para o caminho
    // autenticado (company_id = get_user_company_id(auth.uid())) e o que
    // impediria, aqui, abrir chamado dentro da empresa de outro cliente.
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        title: subject || 'Ticket via Email',
        description: text || html || 'Sem conteúdo',
        requester_name: profile.full_name,
        user_id: profile.id,
        company_id: profile.company_id,
        status: 'open',
        // 'outros' e não 'Suporte Geral': a constraint tickets_category_valid
        // só aceita os slugs minúsculos do vocabulário unificado
        // (20260910171848). Com o texto livre, TODO insert deste canal violava
        // o CHECK e voltava 23514 — ou seja, a abertura por e-mail estava
        // quebrada em silêncio desde que a constraint entrou, sempre caindo no
        // catch genérico como erro 400.
        category: 'outros',
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
