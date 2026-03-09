import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  'open': {
    label: 'Aberto',
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400',
  },
  'in-progress': {
    label: 'Em Andamento',
    dotColor: 'bg-yellow-500',
    badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
  },
  'awaiting-customer': {
    label: 'Aguard. Cliente',
    dotColor: 'bg-purple-500',
    badgeClass: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
  },
  'awaiting-third-party': {
    label: 'Aguard. Terceiro',
    dotColor: 'bg-indigo-500',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400',
  },
  'resolved': {
    label: 'Resolvido',
    dotColor: 'bg-green-500',
    badgeClass: 'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400',
  },
  'closed': {
    label: 'Fechado',
    dotColor: 'bg-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  'reopened': {
    label: 'Reaberto',
    dotColor: 'bg-orange-500',
    badgeClass: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
  },
  'cancelled': {
    label: 'Cancelado',
    dotColor: 'bg-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status] || { label: status, dotColor: 'bg-muted-foreground', badgeClass: '' };
  return (
    <Badge variant="outline" className={cn('gap-1.5', config.badgeClass, className)}>
      <div className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </Badge>
  );
};

export const getStatusLabel = (status: string): string => {
  return statusConfig[status]?.label || status;
};
