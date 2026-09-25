import { describe, expect, it } from 'vitest';
import type { LinhaDoInventario } from './colunasDoInventario';
import { COLUNAS } from './colunasDoInventario';
import { comFiltroNoCabecalho, letraDaColuna, montarLinhasDaPlanilha } from './planilhaDoInventario';

const linha = (parcial: Partial<LinhaDoInventario>): LinhaDoInventario => ({
  id: '1', cliente: 'Acme', maquina: 'PC-01', tipo: 'Computador', os: 'windows', osVersion: '10.0.26200',
  sistema: 'Windows 11', usuario: 'ana', ip: '10.0.0.1', processador: 'Ryzen', memoriaGb: 16, discoGb: null,
  antivirus: 'Defender', versaoAgente: '1.1.33', situacao: 'Online', ultimoContato: null, mac: '—',
  dominio: '—', criadoEm: null, ...parcial,
});

describe('montarLinhasDaPlanilha', () => {
  it('segue o PDF: título, resumo e tabela com as mesmas colunas', () => {
    const dados = montarLinhasDaPlanilha([linha({}), linha({ id: '2' })], 'Acme', new Date(2026, 8, 25, 10, 30));
    expect(dados[0][0].value).toBe('Inventário de máquinas');
    expect(dados[1][0].value).toBe('Acme · 2 máquina(s) · gerado em 25/09/2026 10:30');
    expect(dados[2].map(c => c.value)).toEqual(COLUNAS.map(c => c.titulo));
    expect(dados).toHaveLength(5);
  });

  it('memória sai como número e valor ausente como traço', () => {
    const [, , , primeira] = montarLinhasDaPlanilha([linha({})], 'Acme');
    const memoria = primeira[COLUNAS.findIndex(c => c.chave === 'memoriaGb')];
    const disco = primeira[COLUNAS.findIndex(c => c.chave === 'discoGb')];
    expect(memoria).toMatchObject({ value: 16, type: Number });
    expect(disco).toMatchObject({ value: '—', type: String });
  });
});

describe('filtro do Excel', () => {
  it('converte índice em letra de coluna', () => {
    expect([0, 12, 25, 26].map(letraDaColuna)).toEqual(['A', 'M', 'Z', 'AA']);
  });

  it('liga o filtro a partir do cabeçalho da tabela, logo depois de sheetData', () => {
    expect(comFiltroNoCabecalho('<sheetData></sheetData><pageMargins/>', 13, 5))
      .toBe('<sheetData></sheetData><autoFilter ref="A3:M5"/><pageMargins/>');
  });
});
