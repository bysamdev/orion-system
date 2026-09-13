/**
 * Janela em que o autor pode corrigir a própria avaliação.
 *
 * Espelha a policy ticket_ratings_update e a janela de ticket_updates. O
 * cálculo aqui é só para a UI decidir se mostra o botão de corrigir: quem
 * decide de verdade é o banco, que nega silenciosamente fora da janela (a
 * policy filtra pelo USING, então o UPDATE afeta 0 linhas em vez de dar erro).
 *
 * Manter os 15 minutos em sincronia com
 * 20260913140000_avaliacao_janela_de_edicao.sql.
 */
export const JANELA_EDICAO_MINUTOS = 15;

export function dentroDaJanelaDeEdicao(criadaEm: string, agora: Date = new Date()): boolean {
  const criada = Date.parse(criadaEm);
  if (Number.isNaN(criada)) return false;
  return criada > agora.getTime() - JANELA_EDICAO_MINUTOS * 60 * 1000;
}

/** Minutos inteiros restantes, para o rótulo do botão. Nunca negativo. */
export function minutosRestantesDeEdicao(criadaEm: string, agora: Date = new Date()): number {
  const criada = Date.parse(criadaEm);
  if (Number.isNaN(criada)) return 0;
  const fim = criada + JANELA_EDICAO_MINUTOS * 60 * 1000;
  return Math.max(0, Math.ceil((fim - agora.getTime()) / 60000));
}
