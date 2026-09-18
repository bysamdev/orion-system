// Verificação da assinatura dos webhooks do Resend.
//
// O Resend não aceita cabeçalho estático configurável no webhook (a API de
// criação recebe só endpoint e eventos), então o antigo X-Webhook-Secret não
// tinha como funcionar com ele. Em vez disso ele assina cada entrega pelo
// esquema do Svix, que é o que está implementado aqui.
//
// O esquema, conforme a documentação do Svix:
//
//   conteúdo assinado = `${svix-id}.${svix-timestamp}.${corpo cru}`
//   assinatura        = base64( HMAC-SHA256( chave, conteúdo assinado ) )
//   chave             = base64-decode do segredo, sem o prefixo "whsec_"
//
// O cabeçalho svix-signature pode trazer mais de uma assinatura, separadas por
// espaço e prefixadas pela versão ("v1,abc= v1,def="). Isso existe para a
// rotação de segredo: durante a troca o Resend assina com o velho e o novo.
// Basta uma bater.
//
// Implementado à mão com Web Crypto, sem a biblioteca do Svix, de propósito:
// são poucas linhas de um algoritmo especificado, e a mesma API existe no Deno
// (onde a função roda) e no Node (onde este módulo é testado). Uma dependência
// externa num endpoint público é mais superfície para acompanhar do que o
// próprio código.
//
// Só usa APIs presentes nos dois runtimes: crypto.subtle, TextEncoder, atob e
// btoa. Nada de Deno.* aqui — é o que permite o teste rodar fora do Supabase.

/**
 * Janela aceita entre o carimbo da entrega e o relógio do servidor.
 *
 * Sem ela, uma entrega legítima capturada no caminho poderia ser reenviada
 * depois, com assinatura válida, e abriria o mesmo chamado de novo. Cinco
 * minutos é o valor que o próprio Svix recomenda.
 */
export const TOLERANCIA_SEGUNDOS = 5 * 60

const PREFIXO_SEGREDO = 'whsec_'
const VERSAO_ASSINATURA = 'v1'

// Devolve ArrayBuffer, e não Uint8Array, de propósito. Nas versões recentes do
// TypeScript o Uint8Array é genérico sobre o buffer (Uint8Array<ArrayBufferLike>),
// e esse tipo não é aceito como BufferSource pelo crypto.subtle — funciona em
// runtime, mas o checador de tipos do Deno recusaria o deploy. ArrayBuffer é
// BufferSource em qualquer versão, com ou sem o genérico.
function base64ParaBuffer(b64: string): ArrayBuffer {
  const binario = atob(b64)
  const buffer = new ArrayBuffer(binario.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return buffer
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i])
  return btoa(binario)
}

/**
 * Comparação em tempo constante.
 *
 * Comparar com === devolveria assim que achasse o primeiro byte diferente, e o
 * tempo de resposta vazaria quantos bytes iniciais de uma assinatura forjada
 * estão certos. O tamanho em si não é segredo — HMAC-SHA256 tem sempre 32
 * bytes —, então sair cedo por tamanho diferente não vaza nada.
 */
function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i]
  return diferenca === 0
}

async function assinar(chave: ArrayBuffer, conteudo: string): Promise<Uint8Array> {
  const chaveCripto = await crypto.subtle.importKey(
    'raw',
    chave,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assinatura = await crypto.subtle.sign('HMAC', chaveCripto, new TextEncoder().encode(conteudo))
  return new Uint8Array(assinatura)
}

export type ResultadoDaVerificacao =
  | { valida: true }
  | { valida: false; motivo: 'cabecalho_ausente' | 'segredo_invalido' | 'fora_da_janela' | 'assinatura_nao_confere' }

/**
 * Confere se a entrega veio mesmo do Resend e não foi alterada no caminho.
 *
 * `corpo` precisa ser o texto CRU da requisição, exatamente como chegou. A
 * assinatura é sensível a um espaço a mais: fazer JSON.parse e depois
 * JSON.stringify para verificar mudaria a ordem ou o espaçamento e toda
 * entrega legítima seria recusada.
 *
 * `agoraEmSegundos` existe para o teste poder fixar o relógio.
 */
export async function verificarAssinaturaSvix(
  segredo: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  corpo: string,
  agoraEmSegundos: number = Math.floor(Date.now() / 1000),
): Promise<ResultadoDaVerificacao> {
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valida: false, motivo: 'cabecalho_ausente' }
  }

  if (!segredo.startsWith(PREFIXO_SEGREDO)) {
    return { valida: false, motivo: 'segredo_invalido' }
  }

  let chave: ArrayBuffer
  try {
    chave = base64ParaBuffer(segredo.slice(PREFIXO_SEGREDO.length))
  } catch {
    return { valida: false, motivo: 'segredo_invalido' }
  }

  // A janela vem antes do HMAC: rejeitar reenvio antigo não depende de
  // nenhuma conta, e poupa o trabalho criptográfico de quem já está fora.
  const carimbo = Number(svixTimestamp)
  if (!Number.isFinite(carimbo) || Math.abs(agoraEmSegundos - carimbo) > TOLERANCIA_SEGUNDOS) {
    return { valida: false, motivo: 'fora_da_janela' }
  }

  const esperada = await assinar(chave, `${svixId}.${svixTimestamp}.${corpo}`)

  for (const candidata of svixSignature.split(' ')) {
    const [versao, valor] = candidata.split(',', 2)
    if (versao !== VERSAO_ASSINATURA || !valor) continue

    let recebida: Uint8Array
    try {
      recebida = new Uint8Array(base64ParaBuffer(valor))
    } catch {
      continue
    }

    if (iguaisEmTempoConstante(recebida, esperada)) return { valida: true }
  }

  return { valida: false, motivo: 'assinatura_nao_confere' }
}

// Exposto só para o teste montar entregas assinadas do mesmo jeito que o
// Resend monta. Não é usado pela função.
export async function assinarComoOResend(segredo: string, svixId: string, svixTimestamp: string, corpo: string): Promise<string> {
  const chave = base64ParaBuffer(segredo.slice(PREFIXO_SEGREDO.length))
  const assinatura = await assinar(chave, `${svixId}.${svixTimestamp}.${corpo}`)
  return `${VERSAO_ASSINATURA},${bytesParaBase64(assinatura)}`
}
