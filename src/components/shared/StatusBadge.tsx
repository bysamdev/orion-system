import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStatusConfig, getStatusLabel } from '@/lib/state-tokens';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = getStatusConfig(status);

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={config.ariaLabel}
      className={cn('h-6 gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap', config.badgeClass, className)}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotColor)} aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
};

export { getStatusLabel };
