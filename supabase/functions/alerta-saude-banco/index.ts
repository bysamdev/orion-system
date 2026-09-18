import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0"
import { ehTipoValido, montarMensagem } from './mensagem.ts'

// =============================================================================
// alerta-saude-banco — avisa por e-mail quando o banco entra em laço de erros
// =============================================================================
//
// Existe por causa do incidente de 18/09/2026: o banco passou seis dias a 100%
// de CPU, com mais de 8 milhões de erros por dia, e ninguém foi avisado. Só se
// percebeu pelo aviso de CPU no painel do Supabase.
//
// Quem mede e decide é o banco: public.verificar_saude_do_banco(), a cada 5
// minutos pelo pg_cron, olha o crescimento de pg_stat_database.xact_rollback. Esta
// função só entrega a mensagem. A separação é de propósito: o alerta tem de
// funcionar mesmo com o servidor de monitoramento desligado, que era o caso
// durante o incidente.
//
// Autenticação pelo mesmo segredo compartilhado do e-mail de avaliação
// (x-cron-secret == CRON_DISPATCH_SECRET). Nenhuma credencial nova.
//
// Destinatários: quem tem o papel 'developer'. É um alerta de infraestrutura, e
// os admins podem não ser técnicos. Quem receber o papel passa a receber o aviso
// sem mudar nada aqui.
//
// REGRA GERAL DE STATUS: responde 200 mesmo quando não consegue enviar. Quem
// chama é o pg_net, que não reenvia nem faz nada com o status; um 500 aqui só
// sujaria o log sem ganho nenhum. Os problemas vão para o console.
// =============================================================================

const REMETENTE = 'Orion System <orionsystem@bysam.dev>'

const cabecalhosJson = { 'Content-Type': 'application/json' }

function responder(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhosJson })
}

// Comparação em tempo constante, igual à de send-avaliacao-email: um === de
// string sai no primeiro caractere diferente e deixa o segredo adivinhável por
// tempo de resposta.
function segredosIguais(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a)
  const bytesB = new TextEncoder().encode(b)
  let diferenca = bytesA.length ^ bytesB.length
  const tamanho = Math.max(bytesA.length, bytesB.length)
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0)
  }
  return diferenca === 0
}

interface CorpoDoAlerta {
  tipo?: unknown
  taxa_por_segundo?: unknown
  janela_segundos?: unknown
  desde?: unknown
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return responder(405, { error: 'Método não permitido' })
  }

  const segredo = Deno.env.get('CRON_DISPATCH_SECRET')
  const informado = req.headers.get('x-cron-secret')
  if (!segredo || !informado || !segredosIguais(informado, segredo)) {
    return responder(401, { error: 'Não autorizado' })
  }

  let corpo: CorpoDoAlerta
  try {
    corpo = await req.json()
  } catch {
    return responder(400, { error: 'Corpo inválido' })
  }

  if (!ehTipoValido(corpo.tipo)) {
    return responder(400, { error: 'Tipo de alerta inválido' })
  }

  const mensagem = montarMensagem({
    tipo: corpo.tipo,
    taxa_por_segundo: Number(corpo.taxa_por_segundo) || 0,
    janela_segundos: Number(corpo.janela_segundos) || 0,
    desde: typeof corpo.desde === 'string' ? corpo.desde : null,
  })

  const chaveResend = Deno.env.get('RESEND_API_KEY')
  if (!chaveResend) {
    console.error('[ALERTA] alerta-saude-banco sem RESEND_API_KEY — aviso não enviado:', mensagem.assunto)
    return responder(200, { enviado: false, motivo: 'sem_chave_resend' })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: papeis, error: papeisError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'developer')

    if (papeisError) throw papeisError

    const ids = (papeis ?? []).map((p: { user_id: string }) => p.user_id)
    if (ids.length === 0) {
      console.error('[ALERTA] alerta-saude-banco sem destinatário: ninguém com papel developer —', mensagem.assunto)
      return responder(200, { enviado: false, motivo: 'sem_destinatario' })
    }

    const { data: perfis, error: perfisError } = await supabase
      .from('profiles')
      .select('email')
      .in('id', ids)

    if (perfisError) throw perfisError

    const destinatarios = (perfis ?? [])
      .map((p: { email: string | null }) => p.email)
      .filter((e: unknown): e is string => typeof e === 'string' && e.includes('@') && !e.endsWith('@orion.internal'))

    if (destinatarios.length === 0) {
      console.error('[ALERTA] alerta-saude-banco sem e-mail válido entre os developers —', mensagem.assunto)
      return responder(200, { enviado: false, motivo: 'sem_destinatario' })
    }

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: REMETENTE, to: destinatarios, subject: mensagem.assunto, html: mensagem.html }),
    })

    if (!resposta.ok) {
      console.error('[ALERTA] alerta-saude-banco: Resend respondeu', resposta.status, await resposta.text())
      return responder(200, { enviado: false, motivo: 'falha_resend' })
    }

    const { id } = await resposta.json()
    console.log('alerta-saude-banco:', corpo.tipo, 'enviado para', destinatarios.length, 'destinatário(s), id', id)
    return responder(200, { enviado: true, email_id: id })
  } catch (erro: unknown) {
    console.error('[ALERTA] alerta-saude-banco falhou —', erro instanceof Error ? erro.message : erro, '—', mensagem.assunto)
    return responder(200, { enviado: false, motivo: 'erro_interno' })
  }
})
