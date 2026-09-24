// Decide se o remetente de um e-mail recebido é confiável o bastante para
// abrir chamado em nome do usuário cujo endereço bate com o From (ORN-SEC-21).
//
// A assinatura Svix prova só que o webhook veio do Resend; o From de um
// e-mail pode ser forjado. O Resend informa o resultado de SPF, DKIM e DMARC
// calculado pelo servidor que recebeu a mensagem (campo `authentication` do
// e-mail recebido), com os valores 'pass' | 'fail' | 'gray' |
// 'processing_failed' | 'unknown'.
//
// 'gray' no DMARC significa que SPF ou DKIM passou, mas o domínio não tem
// política DMARC ou usa p=none — é o caso do Gmail. Exigir DMARC 'pass'
// recusaria quase todo remetente legítimo; por isso 'gray' vale quando SPF ou
// DKIM passou de fato.

export type ResultadoAutenticacao = 'pass' | 'fail' | 'gray' | 'processing_failed' | 'unknown'

export interface AutenticacaoDoEmail {
  spf?: unknown
  dkim?: unknown
  dmarc?: unknown
}

export function remetenteAutenticado(autenticacao: AutenticacaoDoEmail | null | undefined): boolean {
  if (!autenticacao) return false
  const { spf, dkim, dmarc } = autenticacao
  if (dmarc === 'pass') return true
  if (dmarc === 'gray') return spf === 'pass' || dkim === 'pass'
  return false
}
