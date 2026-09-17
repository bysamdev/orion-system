import { describe, it, expect } from 'vitest';
import {
  FILTROS_VAZIOS,
  contarFiltrosAtivos,
  temFiltroAtivo,
  intervaloEmISO,
} from './filtrosDeChamados';

describe('contarFiltrosAtivos', () => {
  it('não conta nada no estado neutro', () => {
    expect(contarFiltrosAtivos(FILTROS_VAZIOS)).toBe(0);
    expect(temFiltroAtivo(FILTROS_VAZIOS)).toBe(false);
  });

  it('conta cada filtro preenchido', () => {
    expect(contarFiltrosAtivos({ ...FILTROS_VAZIOS, status: 'open' })).toBe(1);
    expect(contarFiltrosAtivos({ ...FILTROS_VAZIOS, empresaId: 'abc' })).toBe(1);
    expect(
      contarFiltrosAtivos({
        ...FILTROS_VAZIOS,
        status: 'open',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-16',
        contato: 'ana@',
      })
    ).toBe(4);
  });

  it('ignora busca e contato que são só espaço em branco', () => {
    expect(contarFiltrosAtivos({ ...FILTROS_VAZIOS, busca: '   ', contato: '  ' })).toBe(0);
  });
});

describe('intervaloEmISO', () => {
  it('devolve nulo quando não há data', () => {
    expect(intervaloEmISO('', '')).toEqual({ inicio: null, fim: null });
  });

  it('estica o fim até o último milissegundo do dia', () => {
    // Sem isso, "até 16/09" esconderia os chamados abertos no próprio dia 16.
    const { fim } = intervaloEmISO('', '2026-09-16');
    expect(fim).not.toBeNull();
    const d = new Date(fim!);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });

  it('começa o início na primeira hora do dia', () => {
    const { inicio } = intervaloEmISO('2026-09-01', '');
    const d = new Date(inicio!);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('troca as pontas quando o início vem depois do fim', () => {
    const invertido = intervaloEmISO('2026-09-16', '2026-09-01');
    const normal = intervaloEmISO('2026-09-01', '2026-09-16');
    expect(invertido).toEqual(normal);
  });

  it('descarta data inválida em vez de gerar consulta quebrada', () => {
    expect(intervaloEmISO('não-é-data', '')).toEqual({ inicio: null, fim: null });
  });

  it('mantém um intervalo de um dia só cobrindo o dia inteiro', () => {
    const { inicio, fim } = intervaloEmISO('2026-09-10', '2026-09-10');
    expect(new Date(inicio!).getHours()).toBe(0);
    expect(new Date(fim!).getHours()).toBe(23);
    expect(new Date(fim!).getTime()).toBeGreaterThan(new Date(inicio!).getTime());
  });
});
