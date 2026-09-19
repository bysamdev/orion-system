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

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative group text-left p-5 rounded-2xl transition-all duration-200 overflow-hidden bg-card border border-border/50 hover:border-primary/40 shadow-xs hover:shadow-md h-full w-full",
        active
          ? cn("scale-[1.01]", glows[variant])
          : "hover:scale-[1.005]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{value}</h3>
            {active && <ArrowRight className="w-4 h-4 text-primary shrink-0" />}
          </div>
          {description && <p className="text-xs font-medium text-muted-foreground truncate">{description}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105", styles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
};
