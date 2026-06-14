import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateSlaStatus } from '@/lib/ticket-helpers';

interface SLABadgeProps {
  slaStatus: 'ok' | 'attention' | 'breached' | null;
  slaDueDate: string | null;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Badge visual para indicar status do SLA
 * 🟢 Verde: No prazo (> 4h restantes)
 * 🟡 Amarelo: Atenção (< 4h restantes)
 * 🔴 Vermelho: Estourado (Breached)
 */
export const SLABadge: React.FC<SLABadgeProps> = ({ 
  slaStatus, 
  slaDueDate, 
  variant = 'default',
  className 
}) => {
  const dynamicStatus = calculateSlaStatus(slaDueDate) || slaStatus;

  if (!dynamicStatus) {
    return null;
  }

  const timeRemaining = slaDueDate ? formatDistanceToNow(new Date(slaDueDate), {
    locale: ptBR,
    addSuffix: true
  }) : '';

  // Configuração de cores e ícones por status
  const statusConfig = {
    ok: {
      icon: Clock,
      label: 'No prazo',
      color: 'bg-green-500/10 text-green-700 border-green-500/20',
      iconColor: 'text-green-600',
      dot: 'bg-green-500'
    },
    attention: {
      icon: AlertTriangle,
      label: 'Crítico',
      color: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
      iconColor: 'text-orange-600',
      dot: 'bg-orange-500'
    },
    breached: {
      icon: AlertCircle,
      label: 'Vencido',
      color: 'bg-red-500/10 text-red-700 border-red-500/20',
      iconColor: 'text-red-600',
      dot: 'bg-red-500'
    }
  };

  const config = statusConfig[dynamicStatus as 'ok' | 'attention' | 'breached'];
  const Icon = config.icon;

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className={cn("h-2 w-2 rounded-full animate-pulse", config.dot)} />
        <span className={cn("text-xs font-medium", config.iconColor)}>
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 px-2.5 py-1 border",
        config.color,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", config.iconColor)} />
      <span className="font-medium">{config.label}</span>
      {dynamicStatus !== 'breached' && (
        <span className="text-xs opacity-75 capitalize-first">
          ({timeRemaining})
        </span>
      )}
    </Badge>
  );
};
