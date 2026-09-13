/**
 * Avaliação pendente que bloqueia a abertura de um novo chamado.
 *
 * A regra vive no front, de propósito. O banco NÃO bloqueia INSERT em tickets:
 * abertura automática por alerta crítico, abertura por técnico em nome do
 * cliente e integrações futuras passam pelo mesmo caminho e quebrariam. É
 * regra de produto, não de segurança.
 *
 * Bloqueia quando o ÚLTIMO chamado encerrado do usuário está sem avaliação e
 * foi encerrado há 30 dias ou menos. Se o último já foi avaliado (ou pulado),
 * não bloqueia — mesmo que exista um mais antigo sem avaliação.
 *
 * Quatro coisas ficam de fora do bloqueio, e cada uma tem um motivo:
 *
 *   - `cancelled`: chamado cancelado não gerou atendimento a avaliar.
 *   - encerrado há mais de 30 dias: chamado antigo não pode travar a operação
 *     para sempre.
 *   - chamado sem data de encerramento: `closed_at` é preenchido pelo trigger
 *     track_ticket_close_cancel, então um chamado fechado antes dele tem a
 *     data nula. A comparação é escrita como "encerrado há MENOS de 30 dias"
 *     em vez de "NÃO faz mais de 30 dias" justamente por isso — com data nula
 *     a primeira forma não bloqueia, a segunda bloquearia para sempre.
 *   - `metadata.merged_into`: duplicado fechado por mesclagem. O cliente seria
 *     cobrado a avaliar um chamado absorvido por outro, que ele talvez nem
 *     reconheça. Ver 20260913100000_conserta_merge_de_chamados.sql.
 */


export const JANELA_AVALIACAO_DIAS = 30;

export interface ChamadoPendenteDeAvaliacao {
  id: string;
  ticket_number: number;
  title: string;
  encerradoEm: string;
}

export interface LinhaChamado {
  id: string;
  ticket_number: number;
  title: string;
  status: string;
  closed_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  ticket_ratings: { id: string }[] | null;
}

/** Exportada para teste: a decisão, separada do transporte. */
export function selecionarChamadoPendente(
  linhas: LinhaChamado[],
  agora: Date = new Date()
): ChamadoPendenteDeAvaliacao | null {
  const limite = agora.getTime() - JANELA_AVALIACAO_DIAS * 24 * 60 * 60 * 1000;

  const encerrados = linhas
    .map(l => ({ linha: l, encerradoEm: l.closed_at ?? l.resolved_at }))
    .filter((x): x is { linha: LinhaChamado; encerradoEm: string } => x.encerradoEm !== null)
    .sort((a, b) => Date.parse(b.encerradoEm) - Date.parse(a.encerradoEm));

  const ultimo = encerrados[0];
  if (!ultimo) return null;

  const { linha, encerradoEm } = ultimo;
  if ((linha.ticket_ratings?.length ?? 0) > 0) return null;
  if (linha.metadata && linha.metadata['merged_into']) return null;
  if (Date.parse(encerradoEm) < limite) return null;

  return {
    id: linha.id,
    ticket_number: linha.ticket_number,
    title: linha.title,
    encerradoEm,
  };
}
