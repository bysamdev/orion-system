import { describe, it, expect } from 'vitest';
import { resumoDaDescricao, LIMITE_DO_RESUMO } from './resumoDaDescricao';

describe('resumoDaDescricao', () => {
  it('devolve string vazia para ausência, para o card não abrir buraco', () => {
    expect(resumoDaDescricao(null)).toBe('');
    expect(resumoDaDescricao(undefined)).toBe('');
    expect(resumoDaDescricao('')).toBe('');
    expect(resumoDaDescricao('   \n  ')).toBe('');
  });

  it('deixa texto puro curto intacto — o caso de 100% da base hoje', () => {
    expect(resumoDaDescricao('A impressora do financeiro parou de imprimir.'))
      .toBe('A impressora do financeiro parou de imprimir.');
  });

  it('colapsa quebras de linha e espaços em um espaço só', () => {
    expect(resumoDaDescricao('linha um\n\n\nlinha    dois\t\tfim'))
      .toBe('linha um linha dois fim');
  });

  it('remove marcação em vez de exibi-la como texto', () => {
    expect(resumoDaDescricao('<div dir="ltr"><p>Bom dia,</p><p>o ERP caiu.</p></div>'))
      .toBe('Bom dia, o ERP caiu.');
  });

  it('resolve as entidades que vêm de texto colado de editor', () => {
    expect(resumoDaDescricao('Erro&nbsp;em&nbsp;&lt;C:\\temp&gt; &amp; no log'))
      .toBe('Erro em <C:\\temp> & no log');
  });

  it('corta em fronteira de palavra e marca a continuação', () => {
    const longo = 'palavra '.repeat(40).trim();
    const resumo = resumoDaDescricao(longo);

    expect(resumo.length).toBeLessThanOrEqual(LIMITE_DO_RESUMO + 1);
    expect(resumo.endsWith('…')).toBe(true);
    expect(resumo).not.toContain('palavr…');
  });

  it('corta no limite quando não há espaço onde quebrar', () => {
    const semEspaco = 'x'.repeat(400);
    const resumo = resumoDaDescricao(semEspaco);

    expect(resumo).toBe(`${'x'.repeat(LIMITE_DO_RESUMO)}…`);
  });

  it('não deixa pontuação solta antes das reticências', () => {
    const texto = `${'a '.repeat(85).trim()}, e continua`;
    const resumo = resumoDaDescricao(texto);

    expect(resumo).not.toMatch(/[\s.,;:!?-]…$/);
  });

  it('respeita um limite passado à mão', () => {
    expect(resumoDaDescricao('um dois três quatro cinco', 10)).toBe('um dois…');
  });
});
