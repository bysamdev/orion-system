import { describe, it, expect } from 'vitest';
import { ehTituloDeTicketDeTeste } from './testDataDetection';

describe('ehTituloDeTicketDeTeste', () => {
  it('detecta o padrão real que vazou pra produção', () => {
    expect(ehTituloDeTicketDeTeste('[DEBUG-SLA-TEST] Ticket de teste - Prioridade urgent')).toBe(true);
  });

  it('detecta variações de prefixo debug/test', () => {
    expect(ehTituloDeTicketDeTeste('[DEBUG_RATE_LIMIT] teste')).toBe(true);
    expect(ehTituloDeTicketDeTeste('[TEST-X] algo')).toBe(true);
    expect(ehTituloDeTicketDeTeste('[test-lowercase] algo')).toBe(true);
  });

  it('não sinaliza títulos reais de clientes', () => {
    expect(ehTituloDeTicketDeTeste('Impressora não liga')).toBe(false);
    expect(ehTituloDeTicketDeTeste('Erro ao testar o sistema de vendas')).toBe(false);
    expect(ehTituloDeTicketDeTeste('[Urgente] rede caiu')).toBe(false);
  });

  it('lida com título ausente/nulo sem lançar erro', () => {
    expect(ehTituloDeTicketDeTeste(null)).toBe(false);
    expect(ehTituloDeTicketDeTeste(undefined)).toBe(false);
    expect(ehTituloDeTicketDeTeste('')).toBe(false);
  });
});
