/**
 * Reconhece o erro de conflito de versão das funções de chamado
 * (assumir_chamado, atribuir_chamado, resolver_chamado etc.).
 *
 * Ele acontece quando a aba tenta mudar um chamado com um `updated_at` que já
 * não é o atual — outro técnico mexeu no chamado depois que a página carregou.
 *
 * O código é PT409, que o PostgREST converte em HTTP 409 Conflict. Até
 * 18/09/2026 era 40001 (serialization_failure), e isso causou um incidente: o
 * PostgREST repete sozinho transações que falham com 40001, e como o conflito
 * de versão nunca se resolve repetindo, duas requisições ficaram presas em
 * retentativa infinita por seis dias, a 100 por segundo, e levaram o banco a
 * 100% de CPU. Ver a migration 20260918030000_conflito_de_versao_nao_e_retentado.
 *
 * O 40001 continua reconhecido aqui só por segurança, caso alguma função ainda
 * não migrada o levante — mas nenhuma função nova deve usá-lo para este caso.
 */
const CODIGOS_DE_CONFLITO = new Set(['PT409', '40001'])

export const MENSAGEM_DE_CONFLITO =
  'Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.'

export function ehConflitoDeVersao(erro: { code?: string } | null | undefined): boolean {
  return !!erro?.code && CODIGOS_DE_CONFLITO.has(erro.code)
}
