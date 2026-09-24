import { describe, expect, it } from 'vitest';
import type { Ticket } from '@/hooks/useTickets';
import { prazoDe, secaoDe } from './identidade';

const HORA = 60 * 60 * 1000;

function chamado(parcial: Partial<Ticket>): Ticket {
  const agora = Date.now();
  return {
    id: 'x', ticket_number: 1000, title: 'Impressora parada', description: '', requester_name: 'Ana',
    category: 'impressora', priority: 'medium', status: 'open', operator_name: null, assigned_to: null,
    assigned_to_user_id: null, department: null, created_at: new Date(agora - 10 * HORA).toISOString(),
    updated_at: '', company_name: 'Acme', sla_due_date: new Date(agora + 48 * HORA).toISOString(),
    first_response_at: null, resolved_at: null, sla_status: 'ok', remote_id: null, remote_tool: null,
    remote_password: null, sla_paused_at: null, sla_accumulated_pause_minutes: null, contract_id: null, asset_id: null,
    ...parcial,
  } as Ticket;
}

describe('secaoDe', () => {
  it('aberto sem responsável fica na fila', () => {
    expect(secaoDe(chamado({ status: 'open' }))).toBe('fila');
  });

  it('aberto com responsável, em andamento ou reaberto está em atendimento', () => {
    expect(secaoDe(chamado({ status: 'open', assigned_to_user_id: 'tec' }))).toBe('em_atendimento');
    expect(secaoDe(chamado({ status: 'in-progress', assigned_to_user_id: 'tec' }))).toBe('em_atendimento');
    expect(secaoDe(chamado({ status: 'reopened', assigned_to_user_id: 'tec' }))).toBe('em_atendimento');
  });

  it('pausado ou resolvido aguardando encerramento é atendido', () => {
    expect(secaoDe(chamado({ status: 'awaiting-customer' }))).toBe('atendido');
    expect(secaoDe(chamado({ status: 'awaiting-third-party' }))).toBe('atendido');
    expect(secaoDe(chamado({ status: 'resolved' }))).toBe('atendido');
  });

  it('fechado ou cancelado é concluído', () => {
    expect(secaoDe(chamado({ status: 'closed' }))).toBe('concluido');
    expect(secaoDe(chamado({ status: 'cancelled' }))).toBe('concluido');
  });
});

describe('prazoDe', () => {
  it('pinta de verde o que está no prazo', () => {
    expect(prazoDe(chamado({ status: 'in-progress' })).tom).toBe('ok');
  });

  it('pinta de vermelho o que venceu e de laranja o que está perto', () => {
    const agora = Date.now();
    expect(prazoDe(chamado({ status: 'in-progress', sla_due_date: new Date(agora - HORA).toISOString() })).tom).toBe('perigo');
    expect(prazoDe(chamado({
      status: 'in-progress',
      created_at: new Date(agora - 47 * HORA).toISOString(),
      sla_due_date: new Date(agora + HORA).toISOString(),
    })).tom).toBe('alerta');
  });

  it('mostra SLA pausado quando aguarda cliente ou terceiro', () => {
    expect(prazoDe(chamado({ status: 'awaiting-customer' }))).toEqual({ texto: 'SLA pausado', tom: 'pausa' });
  });

  it('não mostra prazo correndo em chamado resolvido ou concluído', () => {
    expect(prazoDe(chamado({ status: 'resolved' })).texto).toBe('Aguardando encerramento');
    expect(prazoDe(chamado({ status: 'closed' })).texto).toBe('Concluído');
  });
});
