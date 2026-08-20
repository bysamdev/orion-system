import { describe, it, expect } from 'vitest';
import { construirFiltroPeriodoRelatorio, STATUS_ATIVOS, filterTickets } from './aggregations';
import type { Ticket } from '@/hooks/useTickets';

describe('construirFiltroPeriodoRelatorio', () => {
  it('inclui os limites de created_at e resolved_at do período', () => {
    const filtro = construirFiltroPeriodoRelatorio({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    expect(filtro).toContain('created_at.gte.2026-07-01T00:00:00');
    expect(filtro).toContain('created_at.lte.2026-07-31T23:59:59.999');
    expect(filtro).toContain('resolved_at.gte.2026-07-01T00:00:00');
    expect(filtro).toContain('resolved_at.lte.2026-07-31T23:59:59.999');
  });

  it('inclui todo status considerado ativo por filterTickets (isAtivo/STATUS_ATIVOS)', () => {
    const filtro = construirFiltroPeriodoRelatorio({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    for (const status of STATUS_ATIVOS) {
      expect(filtro).toContain(status);
    }
  });
});

describe('filterTickets x construirFiltroPeriodoRelatorio (paridade de critério)', () => {
  const baseTicket: Omit<Ticket, 'status' | 'created_at' | 'resolved_at'> = {
    id: '1',
    ticket_number: 1,
    title: 't',
    description: '',
    requester_name: 'r',
    category: 'c',
    priority: 'low',
    operator_name: null,
    assigned_to: null,
    department: null,
    updated_at: '2026-07-15T00:00:00Z',
    company_name: null,
    sla_due_date: null,
    first_response_at: null,
    sla_status: null,
    remote_id: null,
    remote_password: null,
    sla_paused_at: null,
    sla_accumulated_pause_minutes: null,
    contract_id: null,
    asset_id: null,
  };

  const dateFrom = '2026-07-01';
  const dateTo = '2026-07-31';

  it('um ticket antigo e ainda ativo continua incluído mesmo fora do período', () => {
    const ticketAntigoAtivo: Ticket = {
      ...baseTicket,
      status: 'open',
      created_at: '2025-01-01T00:00:00Z',
      resolved_at: null,
    };

    const resultado = filterTickets([ticketAntigoAtivo], {
      dateFrom,
      dateTo,
      companyId: 'all',
      technicianId: 'all',
    });

    expect(resultado).toHaveLength(1);
  });

  it('um ticket antigo e já fechado fora do período é excluído', () => {
    const ticketAntigoFechado: Ticket = {
      ...baseTicket,
      status: 'closed',
      created_at: '2025-01-01T00:00:00Z',
      resolved_at: '2025-01-02T00:00:00Z',
    };

    const resultado = filterTickets([ticketAntigoFechado], {
      dateFrom,
      dateTo,
      companyId: 'all',
      technicianId: 'all',
    });

    expect(resultado).toHaveLength(0);
  });

  it('um ticket criado dentro do período é incluído mesmo já fechado', () => {
    const ticketRecenteFechado: Ticket = {
      ...baseTicket,
      status: 'closed',
      created_at: '2026-07-10T00:00:00Z',
      resolved_at: '2026-07-11T00:00:00Z',
    };

    const resultado = filterTickets([ticketRecenteFechado], {
      dateFrom,
      dateTo,
      companyId: 'all',
      technicianId: 'all',
    });

    expect(resultado).toHaveLength(1);
  });
});
