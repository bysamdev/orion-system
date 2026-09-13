import { describe, it, expect } from 'vitest';
import { selecionarChamadoPendente, JANELA_AVALIACAO_DIAS } from './avaliacaoPendente';

const AGORA = new Date('2026-09-13T12:00:00Z');

const diasAtras = (n: number) =>
  new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

interface OpcoesChamado {
  id?: string;
  status?: string;
  closed_at?: string | null;
  resolved_at?: string | null;
  metadata?: Record<string, unknown> | null;
  avaliado?: boolean;
}

const chamado = (o: OpcoesChamado = {}) => ({
  id: o.id ?? 'ticket-1',
  ticket_number: 1000,
  title: 'Impressora não imprime',
  status: o.status ?? 'closed',
  closed_at: o.closed_at !== undefined ? o.closed_at : diasAtras(1),
  resolved_at: o.resolved_at !== undefined ? o.resolved_at : null,
  metadata: o.metadata ?? null,
  ticket_ratings: o.avaliado ? [{ id: 'r1' }] : [],
});

describe('selecionarChamadoPendente', () => {
  it('bloqueia quando o último chamado fechado não foi avaliado', () => {
    const r = selecionarChamadoPendente([chamado()], AGORA);
    expect(r).not.toBeNull();
    expect(r!.ticket_number).toBe(1000);
  });

  it('não bloqueia quando o chamado já tem avaliação', () => {
    expect(selecionarChamadoPendente([chamado({ avaliado: true })], AGORA)).toBeNull();
  });

  it('não bloqueia um chamado pulado — a linha de "pulou" também é uma avaliação', () => {
    // skipped grava linha em ticket_ratings, então o embed vem preenchido.
    expect(selecionarChamadoPendente([chamado({ avaliado: true })], AGORA)).toBeNull();
  });

  it(`não bloqueia fora da janela de ${JANELA_AVALIACAO_DIAS} dias`, () => {
    expect(selecionarChamadoPendente([chamado({ closed_at: diasAtras(45) })], AGORA)).toBeNull();
  });

  it('bloqueia no limite de dentro da janela', () => {
    expect(selecionarChamadoPendente([chamado({ closed_at: diasAtras(29) })], AGORA)).not.toBeNull();
  });

  it('não bloqueia chamado sem data de encerramento', () => {
    // closed_at é preenchido por track_ticket_close_cancel; chamado fechado
    // antes do trigger tem data nula. Não pode virar bloqueio eterno.
    expect(
      selecionarChamadoPendente([chamado({ closed_at: null, resolved_at: null })], AGORA)
    ).toBeNull();
  });

  it('usa resolved_at quando closed_at é nulo', () => {
    const r = selecionarChamadoPendente(
      [chamado({ closed_at: null, resolved_at: diasAtras(2) })],
      AGORA
    );
    expect(r).not.toBeNull();
    expect(r!.encerradoEm).toBe(diasAtras(2));
  });

  it('não bloqueia duplicado fechado por mesclagem', () => {
    expect(
      selecionarChamadoPendente(
        [chamado({ metadata: { merged_into: 'outro-ticket' } })],
        AGORA
      )
    ).toBeNull();
  });

  it('olha só o último: um antigo sem avaliação não bloqueia se o último foi avaliado', () => {
    const r = selecionarChamadoPendente(
      [
        chamado({ id: 'antigo', closed_at: diasAtras(10), avaliado: false }),
        chamado({ id: 'recente', closed_at: diasAtras(1), avaliado: true }),
      ],
      AGORA
    );
    expect(r).toBeNull();
  });

  it('escolhe o mais recente independentemente da ordem recebida', () => {
    const r = selecionarChamadoPendente(
      [
        chamado({ id: 'recente', closed_at: diasAtras(1) }),
        chamado({ id: 'antigo', closed_at: diasAtras(20) }),
      ],
      AGORA
    );
    expect(r!.id).toBe('recente');
  });

  it('cliente sem histórico não é bloqueado', () => {
    expect(selecionarChamadoPendente([], AGORA)).toBeNull();
  });

  it('chamados sem data não escondem um mais antigo que tem data', () => {
    const r = selecionarChamadoPendente(
      [
        chamado({ id: 'sem-data', closed_at: null, resolved_at: null }),
        chamado({ id: 'com-data', closed_at: diasAtras(3) }),
      ],
      AGORA
    );
    expect(r!.id).toBe('com-data');
  });
});
