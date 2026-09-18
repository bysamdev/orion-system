import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarAssinaturaSvix } from './svix.ts'

// =============================================================================
// email-to-ticket — abre chamado a partir de e-mail recebido pelo Resend
// =============================================================================
//
// Fluxo: alguém escreve para um endereço @bysam.dev, o Resend recebe e chama
// esta função com o evento email.received. A função confere a assinatura,
// identifica o remetente, busca o corpo do e-mail e abre o chamado.
//
// Adaptada ao Resend em 17/09/2026. A versão anterior foi escrita para o formato
// de SendGrid/Mailgun/Postmark e nunca funcionou com o Resend, por três
// diferenças de contrato, todas conferidas na documentação dele:
//
//   1. Autenticação: o Resend assina pelo esquema do Svix e não permite
//      cabeçalho estático, então o X-Webhook-Secret nunca chegaria.
//   2. Formato: o evento vem embrulhado em { type, created_at, data }.
//   3. Corpo: o webhook traz só metadados — sem text e sem html. O conteúdo é
//      buscado numa segunda chamada, pelo email_id.
//
// -----------------------------------------------------------------------------
// Código de resposta decide retentativa
// -----------------------------------------------------------------------------
//
// O Svix reenvia toda entrega que não receber 2xx, por dias, com recuo
// crescente. Isso inverte a lógica que a versão antiga usava: ela respondia 404
// para remetente desconhecido e 409 para avaliação pendente justamente para
// sinalizar recusa, e com o Resend essas respostas fariam o mesmo e-mail voltar
// dezenas de vezes.
//
// A regra passa a ser:
//
//   2xx  a entrega foi PROCESSADA, com o chamado aberto ou recusado por regra
//        de negócio. Reenviar não mudaria nada. O motivo vai no corpo e no log.
//   5xx  falha transitória (banco ou API do Resend fora). Reenviar pode dar
//        certo, então é o que queremos.
//   401  assinatura inválida: não é o Resend, ou é o segredo errado.
//   503  a função não está configurada. Falha FECHADO — sem os segredos, o
//        endpoint recusa tudo em vez de aceitar tudo.
// =============================================================================

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

const API_RESEND = 'https://api.resend.com'

const cabecalhosJson = { 'Content-Type': 'application/json' }

function responder(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhosJson })
}

// Recusa por regra de negócio. 200 de propósito — ver o cabeçalho do arquivo.
function recusar(motivo: string, detalhe: Record<string, unknown> = {}): Response {
  return responder(200, { processado: true, chamado_aberto: false, motivo, ...detalhe })
}

// Formato do evento conforme a documentação do Resend. Os campos são `unknown`
// de propósito: o corpo passou pela assinatura, mas isso prova só que veio do
// Resend, não que tem o formato esperado. Cada campo é conferido com typeof
// antes de usar.
interface EventoDoResend {
  type?: unknown
  data?: {
    email_id?: unknown
    from?: unknown
    subject?: unknown
  }
}

// As colunas de tickets que a regra de avaliação pendente precisa ler.
interface ChamadoEncerrado {
  id: string
  ticket_number: number
  title: string
  closed_at: string | null
  resolved_at: string | null
  metadata: { merged_into?: unknown; fechado_por_inatividade?: unknown } | null
}

type ChamadoComData = ChamadoEncerrado & { encerrado_em: string }

function mascarar(endereco: string): string {
  return endereco ? endereco.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '[desconhecido]'
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return responder(405, { error: 'Método não permitido' })
  }

  const segredoDoWebhook = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const chaveDeLeitura = Deno.env.get('RESEND_INBOUND_API_KEY')

  if (!segredoDoWebhook || !chaveDeLeitura) {
    console.error(
      '[ALERTA] email-to-ticket sem configuração —',
      !segredoDoWebhook ? 'RESEND_WEBHOOK_SECRET ausente' : '',
      !chaveDeLeitura ? 'RESEND_INBOUND_API_KEY ausente' : '',
      '— recusando por segurança',
    )
    return responder(503, { error: 'Webhook não configurado' })
  }

  // O corpo é lido como TEXTO antes de qualquer parse: a assinatura cobre os
  // bytes exatos da requisição, e reconstruir o JSON mudaria espaçamento ou
  // ordem das chaves.
  const corpoCru = await req.text()

  const verificacao = await verificarAssinaturaSvix(
    segredoDoWebhook,
    req.headers.get('svix-id'),
    req.headers.get('svix-timestamp'),
    req.headers.get('svix-signature'),
    corpoCru,
  )

  if (!verificacao.valida) {
    console.error('email-to-ticket: assinatura recusada —', verificacao.motivo)
    return responder(401, { error: 'Não autorizado' })
  }

  let evento: EventoDoResend
  try {
    evento = JSON.parse(corpoCru)
  } catch {
    // Assinatura válida com JSON inválido não é falha transitória: reenviar o
    // mesmo corpo daria o mesmo erro. Responde 2xx para não entrar em laço.
    console.error('email-to-ticket: corpo assinado mas não é JSON')
    return recusar('corpo_invalido')
  }

  // O webhook pode ser assinado para outros eventos também. Qualquer um que não
  // seja e-mail recebido é confirmado e ignorado.
  if (evento?.type !== 'email.received') {
    return responder(200, { processado: true, ignorado: true, tipo: evento?.type ?? null })
  }

  const dados: NonNullable<EventoDoResend['data']> = evento.data ?? {}
  const emailId = typeof dados.email_id === 'string' ? dados.email_id : ''

  // O remetente vem do payload ASSINADO, não da segunda chamada à API: é o
  // campo que decide em nome de quem o chamado abre, então tem que ser o que a
  // assinatura protege. O Resend entrega aqui o endereço puro, sem nome.
  //
  // Normaliza antes de buscar: o remetente pode vir com caixa e espaços do
  // cliente de origem ("  Fulano@Empresa.COM "), e o .eq() é case-sensitive —
  // sem isso o mesmo endereço ora acha o perfil, ora não.
  const remetente = typeof dados.from === 'string' ? dados.from.trim().toLowerCase() : ''
  const remetenteMascarado = mascarar(remetente)

  if (!emailId || !remetente) {
    console.error('email-to-ticket: evento sem email_id ou remetente')
    return recusar('evento_incompleto')
  }

  console.log('email-to-ticket: e-mail recebido de', remetenteMascarado, 'id', emailId)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // -------------------------------------------------------------------------
    // 0. Idempotência
    // -------------------------------------------------------------------------
    // Como a falha transitória devolve 5xx e dispara reenvio, o mesmo e-mail
    // pode chegar mais de uma vez — o caso típico é o chamado ser criado e a
    // resposta se perder no caminho. O email_id do Resend é estável entre
    // reenvios, então ele fica guardado no chamado e é conferido antes de abrir
    // outro.
    //
    // Limitação conhecida: é "confere e depois insere", não uma restrição
    // única no banco. Duas entregas SIMULTÂNEAS do mesmo e-mail ainda poderiam
    // abrir dois chamados. O Svix não faz entregas simultâneas da mesma
    // mensagem, então o caso real — reenvio depois de timeout — está coberto.
    const { data: jaAberto, error: jaAbertoError } = await supabase
      .from('tickets')
      .select('id')
      .eq('metadata->>resend_email_id', emailId)
      .limit(1)
      .maybeSingle()

    if (jaAbertoError) throw jaAbertoError

    if (jaAberto) {
      console.log('email-to-ticket: e-mail', emailId, 'já tinha virado o chamado', jaAberto.id)
      return responder(200, { processado: true, chamado_aberto: true, ticket_id: jaAberto.id, reenvio: true })
    }

    // -------------------------------------------------------------------------
    // 1. Remetente
    // -------------------------------------------------------------------------
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, email')
      .eq('email', remetente)
      .maybeSingle()

    if (profileError) throw profileError

    if (!profile) {
      console.log('email-to-ticket: remetente sem cadastro:', remetenteMascarado)
      return recusar('perfil_inexistente')
    }

    // Conta de máquina: o endereço existe, mas é proibido abrir chamado por
    // ele. O motivo separado é o que distingue no log "ninguém com esse e-mail"
    // de "alguém tentou usar o fantasma do agente".
    if (RE_CONTA_DE_MAQUINA.test(String(profile.email ?? remetente))) {
      console.warn('email-to-ticket: tentativa de abertura por conta de máquina:', remetenteMascarado)
      return recusar('conta_de_maquina')
    }

    // -------------------------------------------------------------------------
    // 2. Avaliação pendente
    // -------------------------------------------------------------------------
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

    let encerrados: ChamadoEncerrado[] = []

    if (!ehEquipeInterna) {
      const { data, error: encerradosError } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, closed_at, resolved_at, metadata')
        .eq('user_id', profile.id)
        // 'cancelled' fica de fora: não houve atendimento a avaliar.
        .in('status', ['resolved', 'closed'])
        .or(`closed_at.gte.${corteDaJanela},resolved_at.gte.${corteDaJanela}`)

      // Falha de leitura NÃO libera a abertura: a regra é de bloqueio, e tratar
      // erro como "sem pendência" seria uma porta dos fundos acionável por
      // indisponibilidade do banco. Sobe para o catch, que devolve 5xx.
      if (encerradosError) throw encerradosError

      encerrados = data ?? []
    }

    const candidatos = encerrados
      .map((t): ChamadoComData | null => {
        const encerradoEm = t.closed_at ?? t.resolved_at
        return encerradoEm ? { ...t, encerrado_em: encerradoEm } : null
      })
      .filter((t): t is ChamadoComData => t !== null)
      .sort((a, b) => (a.encerrado_em < b.encerrado_em ? 1 : -1))

    // Só o ÚLTIMO encerrado importa: se ele já foi avaliado, não bloqueia, mesmo
    // que exista um mais antigo sem avaliação.
    const ultimoEncerrado = candidatos[0] ?? null

    if (ultimoEncerrado) {
      const mesclado = String(ultimoEncerrado.metadata?.merged_into ?? '') !== ''
      const fechadoPorInatividade = String(ultimoEncerrado.metadata?.fechado_por_inatividade ?? '') === 'true'

      if (!mesclado && !fechadoPorInatividade) {
        // Qualquer linha em ticket_ratings resolve a pendência, inclusive as
        // antigas com skipped = true.
        const { data: avaliacao, error: avaliacaoError } = await supabase
          .from('ticket_ratings')
          .select('id')
          .eq('ticket_id', ultimoEncerrado.id)
          .limit(1)
          .maybeSingle()

        if (avaliacaoError) throw avaliacaoError

        if (!avaliacao) {
          console.log('email-to-ticket: avaliação pendente do chamado', ultimoEncerrado.ticket_number, 'para', remetenteMascarado)
          return recusar('avaliacao_pendente', {
            chamado_pendente: {
              ticket_number: ultimoEncerrado.ticket_number,
              title: ultimoEncerrado.title,
              encerrado_em: ultimoEncerrado.encerrado_em,
            },
          })
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Corpo do e-mail
    // -------------------------------------------------------------------------
    // O webhook não traz o conteúdo, só os metadados. Esta busca vem DEPOIS de
    // todas as recusas de propósito: e-mail de desconhecido, de conta de
    // máquina ou de quem tem avaliação pendente não gasta chamada de API.
    const respostaResend = await fetch(`${API_RESEND}/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${chaveDeLeitura}` },
    })

    if (!respostaResend.ok) {
      // 5xx: a API do Resend pode estar fora, e reenviar pode dar certo. Um
      // 401/403 aqui quase sempre é chave sem permissão de leitura — e
      // RESEND_INBOUND_API_KEY precisa ser Full access, porque Sending access
      // só envia.
      throw new Error(`API do Resend respondeu ${respostaResend.status} ao buscar o e-mail ${emailId}`)
    }

    const email = await respostaResend.json()
    const assunto = typeof dados.subject === 'string' && dados.subject.trim() ? dados.subject : email.subject

    // -------------------------------------------------------------------------
    // 4. Chamado
    // -------------------------------------------------------------------------
    // user_id e company_id saem SEMPRE do perfil encontrado pelo remetente,
    // nunca do corpo da requisição. Mesmo que viessem errados, o gatilho
    // set_ticket_company_from_user deriva a empresa do dono da linha quando
    // não há sessão (migration 20260917140000).
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        title: assunto || 'Chamado por e-mail',
        description: email.text || email.html || 'Sem conteúdo',
        requester_name: profile.full_name,
        user_id: profile.id,
        company_id: profile.company_id,
        status: 'open',
        // 'outros' e não 'Suporte Geral': a constraint tickets_category_valid
        // só aceita os slugs minúsculos do vocabulário unificado
        // (20260910171848).
        category: 'outros',
        priority: 'medium',
        metadata: { origem: 'email', resend_email_id: emailId },
      })
      .select('id')
      .single()

    if (ticketError) throw ticketError

    console.log('email-to-ticket: chamado', ticket.id, 'aberto para', remetenteMascarado)

    return responder(200, { processado: true, chamado_aberto: true, ticket_id: ticket.id })
  } catch (erro: unknown) {
    // O detalhe vai só para o log, que apenas a equipe lê. A resposta sai
    // genérica: devolver a mensagem crua expunha nome de constraint, coluna e
    // valor rejeitado para qualquer um que chamasse o endpoint, e foi assim,
    // aliás, que o bug de categoria apareceu. Útil para nós, igualmente útil
    // para quem sondasse o esquema.
    //
    // 500 porque tudo que chega aqui é falha de banco ou de API, e reenviar
    // pode dar certo.
    console.error('email-to-ticket: falha ao processar', emailId, '—', erro instanceof Error ? erro.message : erro)
    return responder(500, { error: 'Falha ao processar o e-mail' })
  }
})
