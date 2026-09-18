// Monta título e descrição do chamado a partir do e-mail, respeitando as regras
// que o banco impõe — e decide quais erros de banco são definitivos.
//
// Módulo puro, sem Deno.*, para ser testado pelo Vitest junto com o resto da
// suíte.

// Espelham as constraints de public.tickets. Se lá mudar, muda aqui:
//   tickets_title_length        CHECK (length(trim(title)) >= 3)
//   tickets_description_length  CHECK (length(trim(description)) >= 10)
export const MINIMO_TITULO = 3
export const MINIMO_DESCRICAO = 10

const TITULO_PADRAO = 'Chamado aberto por e-mail'

function comoTexto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Título do chamado: o assunto do e-mail, ou um texto padrão quando o assunto
 * vem vazio ou curto demais para a regra do banco.
 */
export function montarTitulo(assunto: unknown): string {
  const texto = comoTexto(assunto)
  return texto.length >= MINIMO_TITULO ? texto : TITULO_PADRAO
}

/**
 * Descrição do chamado: o corpo do e-mail, preferindo o texto puro ao HTML.
 *
 * Quando o corpo é curto demais para a regra do banco — o caso que apareceu no
 * primeiro teste real, um e-mail com corpo "teste" —, ele é embrulhado numa
 * frase que deixa claro o que aconteceu. A mensagem original é preservada: o
 * técnico continua vendo exatamente o que a pessoa escreveu.
 *
 * Recusar o e-mail por ser curto seria pior. Quem escreve "o computador não
 * liga" no assunto e nada no corpo tem um problema real, e o chamado precisa
 * nascer.
 */
export function montarDescricao(textoPuro: unknown, html: unknown): string {
  const corpo = comoTexto(textoPuro) || comoTexto(html)

  if (corpo.length >= MINIMO_DESCRICAO) return corpo

  return corpo
    ? `Chamado aberto por e-mail. Mensagem recebida: "${corpo}"`
    : 'Chamado aberto por e-mail, sem texto no corpo da mensagem.'
}

/**
 * Diz se um erro do banco é DEFINITIVO — ou seja, repetir a mesma operação vai
 * dar o mesmo erro, sempre.
 *
 * Isso decide o código de resposta ao Resend. O Resend reenvia tudo que não
 * recebe 2xx; responder 5xx para um erro definitivo faz o mesmo e-mail voltar
 * repetidas vezes sem chance de dar certo. É a mesma armadilha do incidente de
 * 18/09, em que um erro definitivo sinalizado como transitório virou laço
 * infinito no banco.
 *
 * Classes do SQLSTATE consideradas definitivas:
 *   22  data exception                (valor inválido para o tipo)
 *   23  integrity constraint violation (CHECK, NOT NULL, FK, UNIQUE)
 *
 * Todo o resto — rede, banco fora, timeout — continua como transitório.
 */
export function ehErroDefinitivo(codigo: unknown): boolean {
  return typeof codigo === 'string' && (codigo.startsWith('22') || codigo.startsWith('23'))
}
