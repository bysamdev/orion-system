import { describe, expect, it } from 'vitest';
import { ehReaberturaPeloSolicitante } from './reaberturaAutomatica';

const SOLICITANTE = 'aaaaaaaa-0000-0000-0000-000000000001';
const TECNICO = 'bbbbbbbb-0000-0000-0000-000000000002';

describe('ehReaberturaPeloSolicitante', () => {
  it('reconhece a volta para atendimento quando há técnico atribuído', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-customer', new_status: 'in-progress', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(true);
  });

  it('reconhece a volta para a fila quando não há técnico atribuído', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-customer', new_status: 'open', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(true);
  });

  // O caso que dá sentido ao destaque: mesma transição, ator diferente. Sem
  // olhar changed_by, um técnico tirando o chamado da pausa na mão seria
  // anunciado como resposta do cliente.
  it('não marca quando quem tirou da pausa foi o técnico', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-customer', new_status: 'in-progress', changed_by: TECNICO },
        SOLICITANTE
      )
    ).toBe(false);
  });

  // Resposta que chega por e-mail: a Edge Function grava com service_role, sem
  // sessão, então não sobra ator no histórico. Sem este caso o destaque
  // simplesmente não apareceria no canal de e-mail.
  it('reconhece a reabertura vinda por e-mail, que não tem ator', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-customer', new_status: 'in-progress', changed_by: null },
        SOLICITANTE
      )
    ).toBe(true);
  });

  it('não marca uma mudança sem ator que não venha da pausa', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'open', new_status: 'in-progress', changed_by: null },
        SOLICITANTE
      )
    ).toBe(false);
  });

  it('não marca quando o chamado não vinha de uma pausa', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'open', new_status: 'in-progress', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(false);
  });

  // awaiting-third-party é espera de fornecedor. A migration 20260914100000
  // deixou esse estado de fora da reabertura de propósito, e o destaque tem de
  // respeitar a mesma fronteira.
  it('não marca saída de espera de terceiros', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-third-party', new_status: 'in-progress', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(false);
  });

  it('não marca o fechamento de um chamado pausado', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: 'awaiting-customer', new_status: 'closed', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(false);
  });

  it('não marca nada enquanto o solicitante do chamado não carregou', () => {
    const mudanca = {
      old_status: 'awaiting-customer',
      new_status: 'in-progress',
      changed_by: SOLICITANTE,
    };
    expect(ehReaberturaPeloSolicitante(mudanca, null)).toBe(false);
    expect(ehReaberturaPeloSolicitante(mudanca, undefined)).toBe(false);
  });

  it('não marca o registro de status inicial, que não tem status anterior', () => {
    expect(
      ehReaberturaPeloSolicitante(
        { old_status: null, new_status: 'open', changed_by: SOLICITANTE },
        SOLICITANTE
      )
    ).toBe(false);
  });
});
