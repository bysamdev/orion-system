import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: string;
  size?: 'default' | 'sm';
  className?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: 'Urgente',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  high: {
    label: 'Alta',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  },
  medium: {
    label: 'Média',
    className: 'bg-warning/10 text-warning border-warning/30',
  },
  low: {
    label: 'Baixa',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'default', className }) => {
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="outline" className={cn(config.className, size === 'sm' && 'text-[10px] px-1.5 py-0', className)}>
      {config.label}
    </Badge>
  );
};
