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
  
  // Configuração de cores e ícones por status via tokens semânticos
  const statusConfig: Record<string, StatusConfig> = {
    ok: {
      icon: Clock,
      label: 'No prazo',
      color: 'bg-success/15 text-success border-success/30',
      iconColor: 'text-success',
      dot: 'bg-success'
    },
    warning: {
      icon: Clock,
      label: 'Atenção',
      color: 'bg-warning/15 text-warning border-warning/30',
      iconColor: 'text-warning',
      dot: 'bg-warning'
    },
    attention: {
      icon: AlertTriangle,
      label: 'Crítico',
      color: 'bg-warning/20 text-warning border-warning/40',
      iconColor: 'text-warning',
      dot: 'bg-warning'
    },
    breached: {
      icon: AlertCircle,
      label: 'Vencido',
      color: 'bg-destructive/15 text-destructive border-destructive/30',
      iconColor: 'text-destructive',
      dot: 'bg-destructive'
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
