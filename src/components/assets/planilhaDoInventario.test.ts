import { describe, expect, it } from 'vitest';
import type { LinhaDoInventario } from './RelatorioDeInventario';
import { comFiltroNoCabecalho, letraDaColuna, montarAbas, nomeDeAba } from './planilhaDoInventario';

const linha = (parcial: Partial<LinhaDoInventario>): LinhaDoInventario => ({
  id: '1', cliente: 'Acme', maquina: 'PC-01', tipo: 'Computador', os: 'windows', osVersion: '10.0.26200',
  sistema: 'Windows 11', usuario: 'ana', ip: '10.0.0.1', processador: 'Ryzen', memoriaGb: 16, discoGb: 512,
  antivirus: 'Defender', versaoAgente: '1.1.33', situacao: 'Online', ultimoContato: null, mac: '—',
  dominio: '—', criadoEm: null, ...parcial,
});

describe('montarAbas', () => {
  it('com um cliente filtrado gera só a aba dele', () => {
    expect(montarAbas([linha({}), linha({ id: '2' })]).map(a => a.sheet)).toEqual(['Acme']);
  });

  it('com vários clientes gera geral, resumo e uma aba por cliente', () => {
    const abas = montarAbas([linha({ cliente: 'Zeta' }), linha({ id: '2', cliente: 'Acme' })]);
    expect(abas.map(a => a.sheet)).toEqual(['Todos os clientes', 'Resumo por cliente', 'Acme', 'Zeta']);
    expect(abas[2].data).toHaveLength(2);
  });
});

describe('nomeDeAba', () => {
  it('tira caracteres proibidos, corta em 31 e não repete', () => {
    const usados = new Set<string>();
    expect(nomeDeAba('A/B:C', usados)).toBe('A B C');
    expect(nomeDeAba('x'.repeat(40), usados)).toHaveLength(31);
    expect(nomeDeAba('a b c', usados)).toBe('a b c (2)');
  });
});

describe('filtro do Excel', () => {
  it('converte índice em letra de coluna', () => {
    expect([0, 15, 25, 26].map(letraDaColuna)).toEqual(['A', 'P', 'Z', 'AA']);
  });

  it('coloca o autoFilter logo depois de sheetData', () => {
    expect(comFiltroNoCabecalho('<sheetData></sheetData><pageMargins/>', 16, 4))
      .toBe('<sheetData></sheetData><autoFilter ref="A1:P4"/><pageMargins/>');
  });
});
