import { describe, expect, it } from 'vitest';
import type { Ticket } from '@/hooks/useTickets';
import { criarFiltro, CriteriosDoPainel } from './filtroDoPainel';

const HORA = 60 * 60 * 1000;

function chamado(parcial: Partial<Ticket>): Ticket {
  const agora = Date.now();
  return {
    id: 'x', ticket_number: 1000, title: 'Impressora parada', description: '', requester_name: 'Ana',
    category: 'impressora', priority: 'medium', status: 'open', operator_name: null, assigned_to: null,
    department: null, created_at: new Date(agora - 10 * HORA).toISOString(), updated_at: '', company_name: 'Acme',
    sla_due_date: new Date(agora + 48 * HORA).toISOString(), first_response_at: null, resolved_at: null,
    sla_status: 'ok', remote_id: null, remote_tool: null, remote_password: null, sla_paused_at: null,
    sla_accumulated_pause_minutes: null, contract_id: null, asset_id: null,
    ...parcial,
  } as Ticket;
}

const nenhum: CriteriosDoPainel = {
  busca: '', indicador: null, prioridade: 'all', categoria: 'all', status: 'all', tecnico: 'all', empresa: 'all', prazo: 'all',
};

describe('criarFiltro', () => {
  it('sem critério nenhum deixa tudo passar', () => {
    expect(criarFiltro(nenhum)(chamado({}))).toBe(true);
  });

  it('filtra pela categoria gravada no banco', () => {
    const f = criarFiltro({ ...nenhum, categoria: 'rede' });
    expect(f(chamado({ category: 'rede' }))).toBe(true);
    expect(f(chamado({ category: 'impressora' }))).toBe(false);
  });

  it('prazo usa o vencimento real, não o sla_status gravado', () => {
    const f = criarFiltro({ ...nenhum, prazo: 'atrasado' });
    // Gravado como "ok" pelo último cron, mas já venceu.
    const vencido = chamado({ sla_status: 'ok', sla_due_date: new Date(Date.now() - HORA).toISOString() });
    expect(f(vencido)).toBe(true);
    expect(f(chamado({}))).toBe(false);
  });

  it('chamado aguardando cliente conta como SLA pausado', () => {
    const f = criarFiltro({ ...nenhum, prazo: 'pausado' });
    expect(f(chamado({ status: 'awaiting-customer' }))).toBe(true);
  });

  it('status vale também para chamado sem responsável', () => {
    const f = criarFiltro({ ...nenhum, status: 'in-progress' });
    expect(f(chamado({ status: 'open', assigned_to: null }))).toBe(false);
  });

  it('busca aceita # na frente do número', () => {
    const f = criarFiltro({ ...nenhum, busca: '#1000' });
    expect(f(chamado({}))).toBe(true);
    expect(f(chamado({ ticket_number: 2000 }))).toBe(false);
  });

  it('critérios se somam', () => {
    const f = criarFiltro({ ...nenhum, prioridade: 'urgent', empresa: 'acm' });
    expect(f(chamado({ priority: 'urgent' }))).toBe(true);
    expect(f(chamado({ priority: 'urgent', company_name: 'Outra' }))).toBe(false);
    expect(f(chamado({ priority: 'low' }))).toBe(false);
  });
});
