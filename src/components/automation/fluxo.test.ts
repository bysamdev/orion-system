import { describe, expect, it } from 'vitest';
import { descreverAcao, descreverCondicao, problemaNaRegra, type Nomes } from './fluxo';
import { listaDeAcoes, listaDeCondicoes } from '@/hooks/useAutomation';

const nomes: Nomes = {
  empresas: new Map([['e1', 'Acme']]),
  pessoas: new Map([['p1', 'Ana']]),
  templates: new Map([['t1', 'Recebido']]),
};

describe('descrição do fluxo', () => {
  it('traduz categoria, prioridade e empresa para o nome que a pessoa lê', () => {
    expect(descreverCondicao({ field: 'category', operator: 'equals', value: 'rede' }, nomes).valor).toBe('Rede');
    expect(descreverCondicao({ field: 'priority', operator: 'equals', value: 'urgent' }, nomes).valor).toBe('Urgente');
    expect(descreverCondicao({ field: 'company_id', operator: 'equals', value: 'e1' }, nomes).valor).toBe('Acme');
    expect(descreverCondicao({ field: 'title', operator: 'contains', value: 'toner' }, nomes).operador).toBe('contém');
  });

  it('mostra quem recebe e qual template, e avisa quando sumiram', () => {
    expect(descreverAcao({ type: 'assign_tech', target: 'p1' }, nomes).alvo).toBe('Ana');
    expect(descreverAcao({ type: 'auto_response', target: 't1' }, nomes).alvo).toBe('Recebido');
    expect(descreverAcao({ type: 'assign_tech', target: 'xx' }, nomes).alvo).toBe('pessoa removida');
    expect(descreverAcao({ type: 'notify_all', target: '' }, nomes).alvo).toBe('');
    expect(descreverAcao({ type: 'assign_tech', target: '' }, nomes).alvo).toBe('a definir');
  });
});

describe('regras no formato antigo e no novo', () => {
  it('objeto vira lista de um item; lista passa igual', () => {
    expect(listaDeCondicoes({ field: 'category', operator: 'equals', value: 'rede' })).toHaveLength(1);
    expect(listaDeAcoes([{ type: 'notify_all', target: '' }, { type: 'round_robin', target: '' }])).toHaveLength(2);
    expect(listaDeCondicoes(null)).toEqual([]);
  });
});

describe('problemaNaRegra', () => {
  const ok = { field: 'category', operator: 'equals', value: 'rede' };
  it('aceita regra completa', () => {
    expect(problemaNaRegra('Rede N1', 'e1', [ok], [{ type: 'assign_tech', target: 'p1' }])).toBeNull();
    expect(problemaNaRegra('Avisa', 'e1', [ok], [{ type: 'notify_all', target: '' }])).toBeNull();
  });
  it('recusa o que o motor não conseguiria rodar', () => {
    expect(problemaNaRegra('', 'e1', [ok], [{ type: 'notify_all', target: '' }])).toMatch(/nome/);
    expect(problemaNaRegra('x', '', [ok], [{ type: 'notify_all', target: '' }])).toMatch(/empresa/);
    expect(problemaNaRegra('x', 'e1', [{ ...ok, value: ' ' }], [{ type: 'notify_all', target: '' }])).toMatch(/valor/);
    expect(problemaNaRegra('x', 'e1', [ok], [{ type: 'assign_tech', target: '' }])).toMatch(/Atribuir/);
  });
});
