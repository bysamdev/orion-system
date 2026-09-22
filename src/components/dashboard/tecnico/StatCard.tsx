import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'info' | 'warning' | 'success' | 'danger';
  description?: string;
  department?: string;
  active?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, variant = 'default', description, active, onClick }) => {
  const styles = {
    default: 'text-primary bg-primary/10 border-primary/20',
    info: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-400',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };

  const glows = {
    default: 'ring-2 ring-primary/80 bg-primary/5 border-primary/40 shadow-sm',
    info: 'ring-2 ring-cyan-500/80 bg-cyan-500/5 border-cyan-500/40 shadow-sm',
    warning: 'ring-2 ring-amber-500/80 bg-amber-500/5 border-amber-500/40 shadow-sm',
    success: 'ring-2 ring-emerald-500/80 bg-emerald-500/5 border-emerald-500/40 shadow-sm',
    danger: 'ring-2 ring-rose-500/80 bg-rose-500/5 border-rose-500/40 shadow-sm',
  };

  // Sem onClick é só leitura: div, sem cara de botão.
  const Elemento = onClick ? 'button' : 'div';

  return (
    <Elemento
      onClick={onClick}
      className={cn(
        "relative group text-left p-4 rounded-xl transition-colors duration-200 overflow-hidden bg-card border border-border/50 h-full w-full",
        onClick && "hover:border-primary/40",
        active
          ? glows[variant]
          : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</h3>
            {active && <ArrowRight className="w-4 h-4 text-primary shrink-0" />}
          </div>
          {description && <p className="hidden sm:block text-xs font-medium text-muted-foreground truncate">{description}</p>}
        </div>
        <div className={cn("p-2 rounded-lg border shrink-0", styles[variant])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Elemento>
  );
};
