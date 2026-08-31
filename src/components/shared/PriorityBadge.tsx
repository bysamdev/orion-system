import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPriorityConfig, getPriorityLabel } from '@/lib/state-tokens';

interface PriorityBadgeProps {
  priority: string;
  size?: 'default' | 'sm';
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'default', className }) => {
  const config = getPriorityConfig(priority);

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={config.ariaLabel}
      className={cn(
        'whitespace-nowrap transition-colors',
        size === 'sm' ? 'h-5 px-2 text-[10px] font-semibold' : 'h-6 px-2.5 text-xs font-semibold',
        config.badgeClass,
        className
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mr-1.5', config.dotColor)} aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
};

export { getPriorityLabel };
