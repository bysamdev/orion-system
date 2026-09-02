import { describe, it, expect } from 'vitest';
import {
  TICKET_STATUS_MAP,
  TICKET_PRIORITY_MAP,
  SLA_STATUS_MAP,
  getStatusConfig,
  getStatusLabel,
  getPriorityConfig,
  getPriorityLabel,
  getSlaConfig,
  getSlaLabel,
  getRechartsStatusColor,
  getRechartsPriorityColor,
  TicketStatusKey,
  TicketPriorityKey,
  SLAStatusKey,
} from '../state-tokens';

describe('State Tokens Contract (Design System)', () => {
  describe('Ticket Status Tokens', () => {
    const requiredStatuses: TicketStatusKey[] = [
      'open',
      'in-progress',
      'awaiting-customer',
      'awaiting-third-party',
      'resolved',
      'closed',
      'reopened',
      'cancelled',
    ];

    it('should contain all 8 ticket status keys', () => {
      requiredStatuses.forEach((status) => {
        expect(TICKET_STATUS_MAP[status]).toBeDefined();
        expect(TICKET_STATUS_MAP[status].label).toBeTruthy();
        expect(TICKET_STATUS_MAP[status].badgeClass).toBeTruthy();
        expect(TICKET_STATUS_MAP[status].dotColor).toBeTruthy();
        expect(TICKET_STATUS_MAP[status].rechartsColor).toBeTruthy();
        expect(TICKET_STATUS_MAP[status].ariaLabel).toBeTruthy();
      });
    });

    it('should map in-progress to Cyan (preventing amber alert collision)', () => {
      const inProgress = TICKET_STATUS_MAP['in-progress'];
      expect(inProgress.rechartsColor).toBe('#06b6d4');
      expect(inProgress.badgeClass).toContain('text-cyan-700');
      expect(inProgress.dotColor).toBe('bg-cyan-500');
    });

    it('should map cancelled to Slate Muted (reserving red for critical alerts)', () => {
      const cancelled = TICKET_STATUS_MAP['cancelled'];
      expect(cancelled.rechartsColor).toBe('#64748b');
      expect(cancelled.badgeClass).toContain('text-muted-foreground');
      expect(cancelled.badgeClass).not.toContain('bg-destructive');
    });

    it('should provide robust fallback for unknown or null statuses', () => {
      expect(getStatusConfig(null).label).toBe('Desconhecido');
      expect(getStatusConfig('unknown_status').label).toBe('unknown_status');
      expect(getStatusLabel('open')).toBe('Aberto');
      expect(getRechartsStatusColor('open')).toBe('#3b82f6');
    });
  });

  describe('Ticket Priority Tokens', () => {
    const requiredPriorities: TicketPriorityKey[] = ['urgent', 'high', 'medium', 'low'];

    it('should contain all 4 ticket priority keys', () => {
      requiredPriorities.forEach((priority) => {
        expect(TICKET_PRIORITY_MAP[priority]).toBeDefined();
        expect(TICKET_PRIORITY_MAP[priority].label).toBeTruthy();
        expect(TICKET_PRIORITY_MAP[priority].badgeClass).toBeTruthy();
        expect(TICKET_PRIORITY_MAP[priority].dotColor).toBeTruthy();
        expect(TICKET_PRIORITY_MAP[priority].rechartsColor).toBeTruthy();
      });
    });

    it('should support portuguese and legacy fallback names', () => {
      expect(getPriorityConfig('urgente').key).toBe('urgent');
      expect(getPriorityConfig('alta').key).toBe('high');
      expect(getPriorityConfig('média').key).toBe('medium');
      expect(getPriorityConfig('media').key).toBe('medium');
      expect(getPriorityConfig('baixa').key).toBe('low');
      expect(getPriorityLabel('urgent')).toBe('Urgente');
      expect(getRechartsPriorityColor('urgent')).toBe('#ef4444');
    });
  });

  describe('SLA Status Tokens', () => {
    const requiredSlaKeys: SLAStatusKey[] = ['ok', 'warning', 'attention', 'breached'];

    it('should contain all 4 SLA keys', () => {
      requiredSlaKeys.forEach((sla) => {
        expect(SLA_STATUS_MAP[sla]).toBeDefined();
        expect(SLA_STATUS_MAP[sla].label).toBeTruthy();
        expect(SLA_STATUS_MAP[sla].badgeClass).toBeTruthy();
        expect(SLA_STATUS_MAP[sla].dotColor).toBeTruthy();
      });
    });

    it('should resolve correct SLA labels and configs', () => {
      expect(getSlaLabel('ok')).toBe('No prazo');
      expect(getSlaLabel('breached')).toBe('Vencido');
      expect(getSlaConfig(null).key).toBe('ok');
    });
  });
});
