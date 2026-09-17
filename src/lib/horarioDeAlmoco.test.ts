import { describe, expect, it } from 'vitest';
import { estaNoHorarioDeAlmoco, horaNoFusoDaEquipe } from './horarioDeAlmoco';

// Todos os instantes são escritos em UTC de propósito: é assim que a data
// chega no runtime, e escrever o horário local esconderia justamente o que
// estes testes verificam.
//
// São Paulo está em UTC-3 (sem horário de verão desde 2019).
const emUTC = (iso: string) => new Date(iso);

describe('horaNoFusoDaEquipe', () => {
  it('converte para o fuso da equipe, não para o do runtime', () => {
    expect(horaNoFusoDaEquipe(emUTC('2026-09-17T15:30:00Z'))).toBe(12);
  });

  // O padrão en-US devolveria 24 aqui, e "24 >= 12" marcaria a madrugada como
  // almoço. Por isso o hourCycle é explícito.
  it('trata a meia-noite como 0, não como 24', () => {
    expect(horaNoFusoDaEquipe(emUTC('2026-09-17T03:00:00Z'))).toBe(0);
  });
});

describe('estaNoHorarioDeAlmoco', () => {
  it('avisa às 12h em ponto', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T15:00:00Z'))).toBe(true);
  });

  it('avisa no meio da janela', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T16:00:00Z'))).toBe(true);
  });

  it('ainda avisa às 13h59', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T16:59:00Z'))).toBe(true);
  });

  // O limite superior é exclusivo: às 14h em ponto o expediente voltou.
  it('não avisa às 14h em ponto', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T17:00:00Z'))).toBe(false);
  });

  it('não avisa às 11h59', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T14:59:00Z'))).toBe(false);
  });

  it('não avisa de madrugada', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T06:00:00Z'))).toBe(false);
  });

  // Meio-dia em UTC é 9h em São Paulo. Se a função lesse o relógio cru, este
  // caso passaria a avisar.
  it('não avisa ao meio-dia UTC, que é manhã em São Paulo', () => {
    expect(estaNoHorarioDeAlmoco(emUTC('2026-09-17T12:00:00Z'))).toBe(false);
  });
});
