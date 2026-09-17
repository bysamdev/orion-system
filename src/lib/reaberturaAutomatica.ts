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
 * A assinatura da reabertura automática é o conjunto das três condições
 * abaixo, e `changed_by` é o que fecha o caso: numa mudança manual quem aparece
 * é o técnico, nunca o solicitante.
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
  changed_by: string;
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

  return (
    mudanca.old_status === STATUS_PAUSADO &&
    STATUS_DE_RETOMADA.includes(mudanca.new_status) &&
    mudanca.changed_by === solicitanteId
  );
}
