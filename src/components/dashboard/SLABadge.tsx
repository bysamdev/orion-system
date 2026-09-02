import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateSlaStatus } from '@/lib/ticket-helpers';
import { getSlaConfig, getSlaLabel, SLAStatusKey } from '@/lib/state-tokens';

interface SLABadgeProps {
  slaStatus: SLAStatusKey | string | null;
  slaDueDate?: string | null;
  createdAt?: string | null;
  variant?: 'default' | 'compact';
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  ok: Clock,
  warning: Clock,
  attention: AlertTriangle,
  breached: AlertCircle,
};

/**
 * Badge visual canônico para indicar status e contagem regressiva de SLA
 */
export const SLABadge: React.FC<SLABadgeProps> = ({
  slaStatus,
  slaDueDate,
  createdAt,
  variant = 'default',
  className,
}) => {
  const dynamicStatus = (calculateSlaStatus(slaDueDate, createdAt) || slaStatus || 'ok') as SLAStatusKey;
  const config = getSlaConfig(dynamicStatus);
  const Icon = iconMap[dynamicStatus] || Clock;

  const timeRemaining = slaDueDate
    ? formatDistanceToNow(new Date(slaDueDate), {
        locale: ptBR,
        addSuffix: true,
      })
    : '';

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold', className)} role="status" aria-label={config.ariaLabel}>
        <div className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', config.dotColor)} aria-hidden="true" />
        <span className={cn('font-semibold', config.dotColor.replace('bg-', 'text-'))}>{config.label}</span>
      </div>
    );
  }

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={config.ariaLabel}
      className={cn(
        'h-6 gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap',
        config.badgeClass,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
      {dynamicStatus !== 'breached' && timeRemaining && (
        <span className="text-[11px] opacity-80 capitalize-first font-normal">
          ({timeRemaining})
        </span>
      )}
    </Badge>
  );
};

export { getSlaLabel };
