/**
 * Orion System — Fonte Única de Verdade para Estados e Cores Semânticas
 *
 * Mapeamento canônico de Status de Chamados, Níveis de Prioridade, Estados de SLA
 * e paletas do Recharts. Nenhum outro arquivo deve definir classes ou cores ad-hoc de estado.
 */

export type TicketStatusKey =
  | 'open'
  | 'in-progress'
  | 'awaiting-customer'
  | 'awaiting-third-party'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'cancelled';

export type TicketPriorityKey = 'urgent' | 'high' | 'medium' | 'low';

export type SLAStatusKey = 'ok' | 'warning' | 'attention' | 'breached';

export interface StateConfig {
  key: string;
  label: string;
  badgeClass: string;
  dotColor: string;
  rechartsColor: string;
  ariaLabel: string;
}

export const TICKET_STATUS_MAP: Record<TicketStatusKey, StateConfig> = {
  open: {
    key: 'open',
    label: 'Aberto',
    badgeClass:
      'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400 dark:border-blue-500/30',
    dotColor: 'bg-blue-500',
    rechartsColor: '#3b82f6',
    ariaLabel: 'Status: Chamado Aberto',
  },
  'in-progress': {
    key: 'in-progress',
    label: 'Em Atendimento',
    badgeClass:
      'bg-cyan-500/10 text-cyan-700 border-cyan-500/25 dark:text-cyan-400 dark:border-cyan-500/30',
    dotColor: 'bg-cyan-500',
    rechartsColor: '#06b6d4',
    ariaLabel: 'Status: Em Atendimento Ativo',
  },
  'awaiting-customer': {
    key: 'awaiting-customer',
    label: 'Aguard. Cliente',
    badgeClass:
      'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:text-purple-400 dark:border-purple-500/30',
    dotColor: 'bg-purple-500',
    rechartsColor: '#a855f7',
    ariaLabel: 'Status: Aguardando Resposta do Cliente (SLA Pausado)',
  },
  'awaiting-third-party': {
    key: 'awaiting-third-party',
    label: 'Aguard. Terceiro',
    badgeClass:
      'bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-400 dark:border-indigo-500/30',
    dotColor: 'bg-indigo-500',
    rechartsColor: '#6366f1',
    ariaLabel: 'Status: Aguardando Fornecedor Externo (SLA Pausado)',
  },
  resolved: {
    key: 'resolved',
    label: 'Resolvido',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    rechartsColor: '#10b981',
    ariaLabel: 'Status: Chamado Resolvido',
  },
  closed: {
    key: 'closed',
    label: 'Concluído',
    badgeClass: 'bg-muted text-muted-foreground border-border/60',
    dotColor: 'bg-muted-foreground',
    rechartsColor: '#94a3b8',
    ariaLabel: 'Status: Chamado Concluído e Histórico Consolidado',
  },
  reopened: {
    key: 'reopened',
    label: 'Reaberto',
    badgeClass:
      'bg-orange-500/10 text-orange-700 border-orange-500/25 dark:text-orange-400 dark:border-orange-500/30',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'Status: Chamado Reaberto por Reincidência',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Cancelado',
    badgeClass: 'bg-muted/80 text-muted-foreground/80 border-border/40',
    dotColor: 'bg-muted-foreground/60',
    rechartsColor: '#64748b',
    ariaLabel: 'Status: Chamado Cancelado ou Descartado',
  },
};

export const TICKET_PRIORITY_MAP: Record<TicketPriorityKey, StateConfig> = {
  urgent: {
    key: 'urgent',
    label: 'Urgente',
    badgeClass:
      'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15 dark:border-destructive/40 font-bold',
    dotColor: 'bg-destructive',
    rechartsColor: '#ef4444',
    ariaLabel: 'Prioridade: Urgente',
  },
  high: {
    key: 'high',
    label: 'Alta',
    badgeClass:
      'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/40',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'Prioridade: Alta',
  },
  medium: {
    key: 'medium',
    label: 'Média',
    badgeClass:
      'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/40',
    dotColor: 'bg-amber-500',
    rechartsColor: '#f59e0b',
    ariaLabel: 'Prioridade: Média',
  },
  low: {
    key: 'low',
    label: 'Baixa',
    badgeClass: 'bg-muted text-muted-foreground border-border/50',
    dotColor: 'bg-muted-foreground',
    rechartsColor: '#94a3b8',
    ariaLabel: 'Prioridade: Baixa',
  },
};

export const SLA_STATUS_MAP: Record<SLAStatusKey, StateConfig> = {
  ok: {
    key: 'ok',
    label: 'No prazo',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    rechartsColor: '#10b981',
    ariaLabel: 'SLA: No prazo',
  },
  warning: {
    key: 'warning',
    label: 'Atenção',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    rechartsColor: '#f59e0b',
    ariaLabel: 'SLA: Atenção (<= 25% tempo restante)',
  },
  attention: {
    key: 'attention',
    label: 'Crítico',
    badgeClass:
      'bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'SLA: Crítico (<= 10% tempo restante ou menos de 2 horas)',
  },
  breached: {
    key: 'breached',
    label: 'Vencido',
    badgeClass:
      'bg-destructive/15 text-destructive border-destructive/40 font-bold',
    dotColor: 'bg-destructive',
    rechartsColor: '#ef4444',
    ariaLabel: 'SLA: Vencido / Estourado',
  },
};

export function getStatusConfig(status?: string | null): StateConfig {
  const normalized = (status || '').toLowerCase().trim().replace(/_/g, '-') as TicketStatusKey;
  return (
    TICKET_STATUS_MAP[normalized] || {
      key: status || 'unknown',
      label: status || 'Desconhecido',
      badgeClass: 'bg-muted text-muted-foreground border-border/40',
      dotColor: 'bg-muted-foreground',
      rechartsColor: '#94a3b8',
      ariaLabel: `Status: ${status}`,
    }
  );
}

export function getStatusLabel(status?: string | null): string {
  return getStatusConfig(status).label;
}

export function getPriorityConfig(priority?: string | null): StateConfig {
  const normalized = (priority || '').toLowerCase().trim() as TicketPriorityKey;
  // Fallbacks para mapeamentos legados ou em português
  if (normalized === ('urgente' as string) || normalized === ('critica' as string)) {
    return TICKET_PRIORITY_MAP.urgent;
  }
  if (normalized === ('alta' as string)) {
    return TICKET_PRIORITY_MAP.high;
  }
  if (normalized === ('media' as string) || normalized === ('média' as string)) {
    return TICKET_PRIORITY_MAP.medium;
  }
  if (normalized === ('baixa' as string)) {
    return TICKET_PRIORITY_MAP.low;
  }

  return (
    TICKET_PRIORITY_MAP[normalized] || {
      key: priority || 'unknown',
      label: priority || 'Desconhecido',
      badgeClass: 'bg-muted text-muted-foreground border-border/40',
      dotColor: 'bg-muted-foreground',
      rechartsColor: '#94a3b8',
      ariaLabel: `Prioridade: ${priority}`,
    }
  );
}

export function getPriorityLabel(priority?: string | null): string {
  return getPriorityConfig(priority).label;
}

export function getSlaConfig(slaStatus?: string | null): StateConfig {
  const normalized = (slaStatus || '').toLowerCase().trim() as SLAStatusKey;
  return (
    SLA_STATUS_MAP[normalized] || {
      key: slaStatus || 'ok',
      label: slaStatus || 'No prazo',
      badgeClass: 'bg-muted text-muted-foreground border-border/40',
      dotColor: 'bg-muted-foreground',
      rechartsColor: '#10b981',
      ariaLabel: `SLA: ${slaStatus}`,
    }
  );
}

export function getSlaLabel(slaStatus?: string | null): string {
  return getSlaConfig(slaStatus).label;
}

export function getRechartsStatusColor(status: string): string {
  return getStatusConfig(status).rechartsColor;
}

export function getRechartsPriorityColor(priority: string): string {
  return getPriorityConfig(priority).rechartsColor;
}
