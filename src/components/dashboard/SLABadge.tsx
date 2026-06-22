import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateSlaStatus } from '@/lib/ticket-helpers';

interface SLABadgeProps {
  slaStatus: 'ok' | 'warning' | 'attention' | 'breached' | string | null;
  slaDueDate: string | null;
  createdAt?: string | null;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Badge visual para indicar status do SLA
 * 🟢 Verde: No prazo (> 25% restantes)
 * 🟡 Amarelo: Atenção (<= 25% restantes)
 * 🟠 Laranja: Crítico (< 10% restantes ou < 2h restantes)
 * 🔴 Vermelho: Estourado (Breached)
 */
export const SLABadge: React.FC<SLABadgeProps> = ({ 
  slaStatus, 
  slaDueDate,
  createdAt,
  variant = 'default',
  className 
}) => {
  const dynamicStatus = calculateSlaStatus(slaDueDate, createdAt) || slaStatus;

  if (!dynamicStatus) {
    return null;
  }

  const timeRemaining = slaDueDate ? formatDistanceToNow(new Date(slaDueDate), {
    locale: ptBR,
    addSuffix: true
  }) : '';

  interface StatusConfig {
    icon: React.ElementType;
    label: string;
    color: string;
    iconColor: string;
    dot: string;
  }
  
  // Configuração de cores e ícones por status
  const statusConfig: Record<string, StatusConfig> = {
    ok: {
      icon: Clock,
      label: 'No prazo',
      color: 'bg-green-500/10 text-green-700 border-green-500/20',
      iconColor: 'text-green-600',
      dot: 'bg-green-500'
    },
    warning: {
      icon: Clock,
      label: 'Atenção',
      color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
      iconColor: 'text-yellow-600',
      dot: 'bg-yellow-500'
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

  const config = statusConfig[dynamicStatus as string] || statusConfig['ok'];
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
