/**
 * Reconhece, no histórico de status, a reabertura automática de um chamado
 * que estava pausado.
 *
 * Quem executa a reabertura é o gatilho
 * reabre_chamado_quando_cliente_responde (migration 20260914100000): quando o
 * DONO do chamado comenta num chamado em `awaiting-customer`, o status volta
 * para `in-progress` (se houver técnico atribuído) ou `open` (se não houver).
 *
 * O banco grava essa mudança em ticket_status_history como qualquer outra, sem
 * marcar a origem, então na timeline ela ficava idêntica a um técnico mudando
 * o status na mão. Para quem lê o histórico depois, é a diferença entre o
 * chamado ter sido retomado e ter sido esquecido.
 *
 * A assinatura da reabertura automática é a transição (sair de
 * `awaiting-customer` para um estado ativo) mais o ator. Numa mudança manual o
 * ator é o técnico logado; na reabertura automática ele é o solicitante — ou
 * ninguém, quando a resposta chegou por e-mail e quem gravou o comentário foi
 * a Edge Function com service_role, sem sessão. Os dois casos contam, e a
 * ausência de ator só é aceita nessa transição específica justamente porque
 * mudança manual sempre tem alguém autenticado por trás.
 *
 * POR QUE NÃO VEIO DO BANCO: a tentativa natural seria o próprio gatilho
 * gravar um motivo na coluna `reason`. Não funciona. O gatilho que escreve o
 * histórico é AFTER UPDATE em `tickets`, e gatilhos AFTER de uma instrução
 * aninhada só disparam quando a instrução externa termina — nesse ponto a
 * função que faria a marcação já retornou e qualquer variável de transação que
 * ela tivesse setado já foi restaurada. Medido, não suposto.
 */

/** O estado de pausa do qual a reabertura automática parte. */
const STATUS_PAUSADO = 'awaiting-customer';

/** Para onde o gatilho devolve o chamado, com e sem técnico atribuído. */
const STATUS_DE_RETOMADA = ['in-progress', 'open'];

export interface MudancaDeStatus {
  old_status: string | null;
  new_status: string;
  /**
   * `auth.uid()` no instante da mudança. Vem nulo quando a mudança nasceu fora
   * de uma sessão autenticada — é o caso da resposta que chega por e-mail, em
   * que a Edge Function email-to-ticket grava o comentário com service_role.
   */
  changed_by: string | null;
}

/**
 * `solicitanteId` é o `user_id` do chamado — quem o abriu. Vem como
 * `null`/`undefined` enquanto o chamado ainda não carregou, e nesse caso nada
 * é destacado: melhor não marcar do que marcar errado.
 */
export function ehReaberturaPeloSolicitante(
  mudanca: MudancaDeStatus,
  solicitanteId: string | null | undefined
): boolean {
  if (!solicitanteId) return false;

  const veioDaPausa =
    mudanca.old_status === STATUS_PAUSADO && STATUS_DE_RETOMADA.includes(mudanca.new_status);

  if (!veioDaPausa) return false;

  // Resposta pelo app: o solicitante está logado e aparece como autor.
  // Resposta por e-mail: não há sessão, e o autor fica nulo.
  return mudanca.changed_by === solicitanteId || mudanca.changed_by === null;
}
