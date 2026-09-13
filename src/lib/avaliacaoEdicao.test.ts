import { describe, it, expect } from 'vitest';
import {
  dentroDaJanelaDeEdicao,
  minutosRestantesDeEdicao,
  JANELA_EDICAO_MINUTOS,
} from './avaliacaoEdicao';

const AGORA = new Date('2026-09-13T12:00:00Z');
const minutosAtras = (n: number) => new Date(AGORA.getTime() - n * 60 * 1000).toISOString();

describe('dentroDaJanelaDeEdicao', () => {
  it('aceita uma avaliação recém-criada', () => {
    expect(dentroDaJanelaDeEdicao(minutosAtras(0), AGORA)).toBe(true);
  });

  it('aceita dentro dos 15 minutos', () => {
    expect(dentroDaJanelaDeEdicao(minutosAtras(14), AGORA)).toBe(true);
  });

  it('recusa exatamente no limite', () => {
    // A policy usa "created_at > now() - 15 min", estritamente maior.
    expect(dentroDaJanelaDeEdicao(minutosAtras(JANELA_EDICAO_MINUTOS), AGORA)).toBe(false);
  });

  it('recusa depois da janela', () => {
    expect(dentroDaJanelaDeEdicao(minutosAtras(40), AGORA)).toBe(false);
  });

  it('recusa data inválida em vez de mostrar um botão que o banco vai negar', () => {
    expect(dentroDaJanelaDeEdicao('nao é data', AGORA)).toBe(false);
  });
});

describe('minutosRestantesDeEdicao', () => {
  it('conta o que falta, arredondando para cima', () => {
    expect(minutosRestantesDeEdicao(minutosAtras(2), AGORA)).toBe(13);
  });

  it('nunca devolve negativo', () => {
    expect(minutosRestantesDeEdicao(minutosAtras(60), AGORA)).toBe(0);
  });

  it('devolve 0 para data inválida', () => {
    expect(minutosRestantesDeEdicao('', AGORA)).toBe(0);
  });
});
