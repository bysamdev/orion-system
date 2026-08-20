import { describe, it, expect } from 'vitest';
import { resolverNomeExibicao } from './routingRuleDisplay';

describe('resolverNomeExibicao', () => {
  const nomes = new Map([
    ['tec-1', 'Maria Silva'],
    ['tec-2', 'João Souza'],
  ]);

  it('resolve o UUID pro nome quando encontrado (caso corrigido: não mostra mais o UUID)', () => {
    expect(resolverNomeExibicao('tec-1', false, nomes, 'Técnico removido')).toBe('Maria Silva');
  });

  it('usa o fallback quando o id não existe mais na lista (ex: técnico removido)', () => {
    expect(resolverNomeExibicao('tec-999-nao-existe', false, nomes, 'Técnico removido')).toBe('Técnico removido');
  });

  it('usa o fallback quando o id é undefined', () => {
    expect(resolverNomeExibicao(undefined, false, nomes, 'Técnico removido')).toBe('Técnico removido');
  });

  it('mostra estado de carregamento em vez do fallback enquanto a lista ainda não chegou', () => {
    // Evita o "flash" de "Técnico removido" enquanto a query de technicians
    // ainda está em andamento e o Map está vazio.
    expect(resolverNomeExibicao('tec-1', true, new Map(), 'Técnico removido')).toBe('…');
  });
});
