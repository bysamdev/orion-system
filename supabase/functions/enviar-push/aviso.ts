// Regras puras do envio de Web Push, separadas do index.ts para serem testadas
// com vitest (o index depende de Deno e da rede).

export interface NotificacaoParaPush {
  id: string
  title: string
  message: string
  link: string | null
}

export interface AvisoPush {
  title: string
  body: string
  url: string
  tag: string
}

// O navegador corta textos longos de forma diferente em cada sistema; limitar
// aqui também mantém o payload bem abaixo dos ~4 KB que o serviço de push aceita.
const LIMITE_TITULO = 80
const LIMITE_CORPO = 200

function cortar(texto: string, limite: number): string {
  const limpo = texto.trim()
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo
}

// Só links internos do Orion: o link vem do banco, mas o clique na notificação
// abre uma janela, então nada de URL absoluta para outro domínio.
function linkInterno(link: string | null): string {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return '/'
  return link
}

// Validade do aviso no serviço de push. Com o navegador fechado o aviso fica
// na fila e chega quando ele abre; 24 h fazia chegar uma leva de avisos velhos.
// Passado este prazo o aviso é descartado (o sino continua com o histórico).
export const VALIDADE_DO_PUSH_SEGUNDOS = 15 * 60

export function montarAviso(n: NotificacaoParaPush): AvisoPush {
  const url = linkInterno(n.link)
  return {
    title: cortar(n.title || 'Orion System', LIMITE_TITULO),
    body: cortar(n.message || '', LIMITE_CORPO),
    url,
    // Um aviso por chamado: o novo substitui o anterior do mesmo chamado em
    // vez de empilhar. Sem link, cada notificação tem o seu.
    tag: url === '/' ? `orion-${n.id}` : `orion-${url}`,
  }
}

// 404 e 410: o navegador descartou a inscrição (permissão retirada, app
// desinstalado, chave trocada). Qualquer outro erro pode ser passageiro.
export function inscricaoExpirada(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}
