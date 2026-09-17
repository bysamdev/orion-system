/**
 * Filtros da tela de Histórico de chamados.
 *
 * Um objeto só, em vez de um punhado de useState soltos e de uma lista de
 * parâmetros que cresce a cada filtro novo. Acrescentar um filtro passa a ser:
 * um campo aqui, um caso em `aplicarFiltrosNaQuery` (src/hooks/useMyTickets.ts)
 * e o controle na tela — sem tocar em assinatura de função.
 *
 * As datas são strings "AAAA-MM-DD" porque é o que <input type="date"> entrega.
 * A conversão para instante acontece em `intervaloEmISO`, que é onde mora a
 * regra do dia inteiro.
 */

export interface FiltrosDeChamados {
  status: string;
  prioridade: string;
  busca: string;
  /** Data de ABERTURA (created_at). "AAAA-MM-DD" ou vazio. */
  dataInicio: string;
  dataFim: string;
  /** company_id. Só a equipe interna escolhe; cliente fica preso à própria. */
  empresaId: string;
  /** E-mail (ou parte) do solicitante. */
  contato: string;
}

export const FILTROS_VAZIOS: FiltrosDeChamados = {
  status: 'all',
  prioridade: 'all',
  busca: '',
  dataInicio: '',
  dataFim: '',
  empresaId: 'all',
  contato: '',
};

/** Um filtro está ativo quando difere do estado neutro. */
export function contarFiltrosAtivos(filtros: FiltrosDeChamados): number {
  let ativos = 0;
  if (filtros.status !== 'all') ativos++;
  if (filtros.prioridade !== 'all') ativos++;
  if (filtros.busca.trim() !== '') ativos++;
  if (filtros.dataInicio !== '') ativos++;
  if (filtros.dataFim !== '') ativos++;
  if (filtros.empresaId !== 'all') ativos++;
  if (filtros.contato.trim() !== '') ativos++;
  return ativos;
}

export function temFiltroAtivo(filtros: FiltrosDeChamados): boolean {
  return contarFiltrosAtivos(filtros) > 0;
}

/**
 * Converte o intervalo do formulário em instantes para comparar com
 * created_at (timestamptz).
 *
 * O fim vai para o ÚLTIMO milissegundo do dia escolhido. Sem isso, filtrar
 * "até 16/09" compararia contra 16/09 00:00 e esconderia todos os chamados
 * abertos naquele mesmo dia — o erro clássico de intervalo de datas, e o mais
 * difícil de perceber, porque a lista volta com resultado, só que incompleto.
 *
 * Datas invertidas (início depois do fim) são devolvidas trocadas em vez de
 * gerarem uma consulta que nunca casa: é quase sempre engano de digitação, e
 * uma lista vazia sem explicação parece defeito do sistema.
 */
export function intervaloEmISO(
  dataInicio: string,
  dataFim: string
): { inicio: string | null; fim: string | null } {
  let inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
  let fim = dataFim ? new Date(`${dataFim}T23:59:59.999`) : null;

  if (inicio && isNaN(inicio.getTime())) inicio = null;
  if (fim && isNaN(fim.getTime())) fim = null;

  if (inicio && fim && inicio.getTime() > fim.getTime()) {
    const trocado = new Date(`${dataFim}T00:00:00`);
    const trocadoFim = new Date(`${dataInicio}T23:59:59.999`);
    return { inicio: trocado.toISOString(), fim: trocadoFim.toISOString() };
  }

  return {
    inicio: inicio ? inicio.toISOString() : null,
    fim: fim ? fim.toISOString() : null,
  };
}
