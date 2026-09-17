/**
 * Janela de almoço da equipe de suporte.
 *
 * Chamado aberto neste intervalo tende a demorar mais para ter a primeira
 * resposta, simplesmente porque há menos gente na mesa. O aviso existe para
 * ajustar a expectativa de quem abre — não bloqueia nada e não muda SLA.
 *
 * O fuso é fixo em America/Sao_Paulo, não o do navegador. Quem abre chamado de
 * outro fuso (ou com o relógio da máquina errado) precisa ver a janela da
 * equipe que vai atender, que é a única que importa aqui. É o mesmo raciocínio
 * da função adiciona_dias_uteis no banco, que também converte antes de olhar
 * para o relógio.
 */

const FUSO_DA_EQUIPE = 'America/Sao_Paulo';

/** Início da janela, hora cheia. */
export const ALMOCO_INICIO = 12;

/** Fim da janela, exclusivo: às 14h em ponto o expediente já voltou. */
export const ALMOCO_FIM = 14;

/**
 * Hora do dia (0–23) no fuso da equipe.
 *
 * `en-GB` com hourCycle 'h23' devolve 00–23; o padrão `en-US` devolveria "24"
 * para a meia-noite, que quebraria a comparação numérica.
 */
export function horaNoFusoDaEquipe(agora: Date): number {
  const formatada = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_DA_EQUIPE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(agora);

  return Number.parseInt(formatada, 10);
}

/** Verdadeiro entre 12:00 e 13:59 no horário de São Paulo. */
export function estaNoHorarioDeAlmoco(agora: Date = new Date()): boolean {
  const hora = horaNoFusoDaEquipe(agora);
  return hora >= ALMOCO_INICIO && hora < ALMOCO_FIM;
}
