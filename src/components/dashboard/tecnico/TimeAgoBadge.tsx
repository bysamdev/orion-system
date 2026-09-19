import React from 'react';
import { Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Tempo decorrido, com o horário exato no hover.
export const TimeAgoBadge: React.FC<{ date: string | Date | undefined | null }> = ({ date }) => {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground text-xs">—</span>;

  const timeAgo = formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  const exactTime = format(d, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground font-medium transition-colors cursor-help group/time">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/time:text-primary transition-colors shrink-0" />
          <span className="capitalize">{timeAgo}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover/95 backdrop-blur-sm border-border/60 shadow-xl text-xs px-3 py-1.5 rounded-xl z-50">
        <div className="space-y-0.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Horário de abertura</p>
          <p className="text-foreground font-mono font-semibold">{exactTime}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
