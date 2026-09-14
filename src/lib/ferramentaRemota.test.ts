import { describe, it, expect } from 'vitest';
import {
  FERRAMENTAS_REMOTAS,
  rotuloDaFerramentaRemota,
  campoDeIdRemoto,
} from './ferramentaRemota';

describe('ferramentaRemota', () => {
  it('só oferece valores que o CHECK do banco aceita, em minúsculo', () => {
    // tickets_remote_tool_valid é sensível a caixa: 'TeamViewer' devolve
    // 23514. Este teste é o que impede alguém de "arrumar" a capitalização.
    expect(FERRAMENTAS_REMOTAS.map((f) => f.valor)).toEqual(['teamviewer', 'anydesk']);
  });

  it('traduz os valores gravados para rótulo de exibição', () => {
    expect(rotuloDaFerramentaRemota('teamviewer')).toBe('TeamViewer');
    expect(rotuloDaFerramentaRemota('anydesk')).toBe('AnyDesk');
  });

  it('trata ausência como "não informada", não como erro', () => {
    // É o estado de todo chamado anterior a 2026-09-14.
    expect(rotuloDaFerramentaRemota(null)).toBe('Ferramenta não informada');
    expect(rotuloDaFerramentaRemota(undefined)).toBe('Ferramenta não informada');
    expect(rotuloDaFerramentaRemota('')).toBe('Ferramenta não informada');
  });

  it('não esconde um valor inesperado vindo do banco', () => {
    expect(rotuloDaFerramentaRemota('rustdesk')).toBe('rustdesk');
  });

  it('muda o rótulo do campo de ID conforme a escolha', () => {
    expect(campoDeIdRemoto('teamviewer').rotulo).toBe('ID TeamViewer');
    expect(campoDeIdRemoto('anydesk').rotulo).toBe('Endereço AnyDesk');
  });

  it('usa texto neutro enquanto nada foi escolhido', () => {
    const { rotulo, placeholder } = campoDeIdRemoto(null);
    expect(rotulo).toBe('ID de acesso remoto');
    expect(placeholder).toContain('AnyDesk');
  });
});
