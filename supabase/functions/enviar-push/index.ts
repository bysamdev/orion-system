// Web Push: disparada pelo trigger trg_dispara_push_da_notificacao (pg_net,
// fire-and-forget) a cada notificação nova. Manda o aviso para todos os
// navegadores inscritos do usuário e apaga as inscrições que o navegador
// invalidou.
//
// Autenticação por segredo compartilhado (x-cron-secret == CRON_DISPATCH_SECRET),
// no mesmo padrão de send-avaliacao-email; verify_jwt = false no config.toml.
// Secrets necessários: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (mailto: do responsável).
//
// Fora do 401/400, responde sempre 200: a notificação interna já foi gravada
// e é ela a fonte da verdade; o push é só um aviso a mais.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'
import webpush from 'npm:web-push@3.6.7'
import { VALIDADE_DO_PUSH_SEGUNDOS, inscricaoExpirada, montarAviso } from './aviso.ts'

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

// Comparação em tempo constante, igual à de send-avaliacao-email.
function segredosIguais(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a)
  const bytesB = new TextEncoder().encode(b)
  let diferenca = bytesA.length ^ bytesB.length
  const tamanho = Math.max(bytesA.length, bytesB.length)
  for (let i = 0; i < tamanho; i++) diferenca |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0)
  return diferenca === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const cronSecret = Deno.env.get('CRON_DISPATCH_SECRET')
  const recebido = req.headers.get('x-cron-secret')
  if (!cronSecret || !recebido || !segredosIguais(recebido, cronSecret)) {
    return json({ error: 'Não autorizado' }, 401)
  }

  const body = await req.json().catch(() => null)
  const notificationId = body?.notification_id
  if (typeof notificationId !== 'string') return json({ error: 'notification_id ausente' }, 400)

  const chavePublica = Deno.env.get('VAPID_PUBLIC_KEY')
  const chavePrivada = Deno.env.get('VAPID_PRIVATE_KEY')
  const contato = Deno.env.get('VAPID_SUBJECT')
  if (!chavePublica || !chavePrivada || !contato) {
    console.warn('enviar-push: chaves VAPID não configuradas')
    return json({ enviados: 0, motivo: 'VAPID não configurado' })
  }
  webpush.setVapidDetails(contato, chavePublica, chavePrivada)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: notificacao } = await admin
    .from('notifications')
    .select('id, user_id, title, message, link')
    .eq('id', notificationId)
    .maybeSingle()
  if (!notificacao) return json({ enviados: 0, motivo: 'notificação não encontrada' })

  const { data: inscricoes } = await admin
    .from('push_inscricoes')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notificacao.user_id)
  if (!inscricoes?.length) return json({ enviados: 0, motivo: 'sem inscrições' })

  const aviso = JSON.stringify(montarAviso(notificacao))
  let enviados = 0
  const expiradas: string[] = []

  await Promise.all(inscricoes.map(async (i) => {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        aviso,
        { TTL: VALIDADE_DO_PUSH_SEGUNDOS, urgency: 'high' },
      )
      enviados++
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode
      if (inscricaoExpirada(status)) expiradas.push(i.id)
      // Sem o endpoint no log: ele identifica o navegador da pessoa.
      else console.warn('enviar-push: falha no envio', status ?? String(erro))
    }
  }))

  if (expiradas.length) await admin.from('push_inscricoes').delete().in('id', expiradas)

  return json({ enviados, removidas: expiradas.length })
})
