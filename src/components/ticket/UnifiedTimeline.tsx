import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, RotateCcw, Timer, Lock, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TicketUpdate } from '@/hooks/useTickets';
import { TimeEntry } from '@/hooks/useTimeEntries';

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

interface UnifiedTimelineProps {
  updates: TicketUpdate[];
  statusHistory?: StatusHistoryEntry[];
  timeEntries?: TimeEntry[];
}

type TimelineItem = {
  id: string;
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'status_history' | 'time_entry';
  author: string;
  content: string;
  created_at: string;
  isInternal?: boolean;
  meta?: Record<string, any>;
};

const statusLabels: Record<string, string> = {
  'open': 'Aberto', 'in-progress': 'Em Andamento', 'awaiting-customer': 'Aguard. Cliente',
  'awaiting-third-party': 'Aguard. Terceiro', 'resolved': 'Resolvido', 'closed': 'Fechado',
  'reopened': 'Reaberto', 'cancelled': 'Cancelado',
};

// Converte dados crus para itens unificados
const buildTimeline = (updates: TicketUpdate[], statusHistory: StatusHistoryEntry[], timeEntries: TimeEntry[]): TimelineItem[] => {
  const items: TimelineItem[] = [];

  updates.forEach(u => {
    items.push({
      id: u.id,
      type: u.type as any,
      author: u.author,
      content: u.content,
      created_at: u.created_at,
      isInternal: u.is_internal,
    });
  });

  statusHistory.forEach(sh => {
    // Evita duplicar com updates do tipo status_change
    items.push({
      id: `sh-${sh.id}`,
      type: 'status_history',
      author: sh.changed_by,
      content: sh.old_status
        ? `${statusLabels[sh.old_status] || sh.old_status} → ${statusLabels[sh.new_status] || sh.new_status}`
        : `Status inicial: ${statusLabels[sh.new_status] || sh.new_status}`,
      created_at: sh.created_at,
      meta: { reason: sh.reason },
    });
  });

  timeEntries.forEach(te => {
    const duration = te.duration_minutes || 0;
    const h = Math.floor(duration / 60);
    const m = duration % 60;
    const durationStr = h > 0 ? `${h}h${m > 0 ? `${m}min` : ''}` : `${m}min`;
    items.push({
      id: `te-${te.id}`,
      type: 'time_entry',
      author: te.user_id, // idealmente seria o nome, mas usamos o ID por ora
      content: te.description || 'Apontamento de horas',
      created_at: te.start_time,
      meta: { duration: durationStr, billable: te.billable, running: !te.end_time },
    });
  });

  // Ordenar cronologicamente
  items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return items;
};

const TimelineItemIcon: React.FC<{ type: string; isInternal?: boolean }> = ({ type, isInternal }) => {
  if (isInternal) return <Lock className="w-3.5 h-3.5 text-amber-600" />;
  switch (type) {
    case 'status_change':
    case 'status_history':
      return <RotateCcw className="w-3.5 h-3.5 text-yellow-500" />;
    case 'assignment':
      return <User className="w-3.5 h-3.5 text-purple-500" />;
    case 'priority_change':
      return <AlertCircle className="w-3.5 h-3.5 text-blue-500" />;
    case 'time_entry':
      return <Timer className="w-3.5 h-3.5 text-primary" />;
    default:
      return <MessageSquare className="w-3.5 h-3.5 text-green-500" />;
  }
};

const TimelineEntry: React.FC<{ item: TimelineItem; isLast: boolean }> = ({ item, isLast }) => {
  const iconBg = item.isInternal ? 'bg-amber-500/20'
    : item.type === 'status_history' || item.type === 'status_change' ? 'bg-yellow-500/20'
    : item.type === 'assignment' ? 'bg-purple-500/20'
    : item.type === 'time_entry' ? 'bg-primary/20'
    : 'bg-green-500/20';

  return (
    <div className="flex gap-3 md:gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', iconBg)}>
          <TimelineItemIcon type={item.type} isInternal={item.isInternal} />
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border mt-2" />}
      </div>
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-foreground text-sm truncate max-w-[200px]">{item.author}</span>
            {item.isInternal && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
                <Lock className="w-3 h-3 mr-1" />
                Nota Interna
              </Badge>
            )}
            {item.type === 'time_entry' && item.meta && (
              <Badge variant="outline" className="text-xs gap-1">
                <Timer className="w-3 h-3" />
                {item.meta.running ? 'Em andamento' : item.meta.duration}
                {item.meta.billable && ' • Faturável'}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
          </span>
        </div>
        <p className={cn(
          'text-sm leading-relaxed break-words whitespace-pre-wrap',
          item.isInternal
            ? 'text-foreground bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'
            : item.type === 'comment'
              ? 'text-foreground bg-muted/30 rounded-lg p-3'
              : 'text-muted-foreground italic'
        )}>
          {item.content}
        </p>
        {item.meta?.reason && (
          <p className="text-xs text-muted-foreground mt-1 italic">Motivo: {item.meta.reason}</p>
        )}
      </div>
    </div>
  );
};

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({
  updates,
  statusHistory = [],
  timeEntries = [],
}) => {
  const allItems = buildTimeline(updates, statusHistory, timeEntries);
  const commentItems = allItems.filter(i => i.type === 'comment');
  const statusItems = allItems.filter(i => i.type === 'status_change' || i.type === 'status_history');
  const timeItems = allItems.filter(i => i.type === 'time_entry');

  const renderList = (items: TimelineItem[]) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro encontrado.</p>;
    }
    return (
      <div className="space-y-0">
        {items.map((item, idx) => (
          <TimelineEntry key={item.id} item={item} isLast={idx === items.length - 1} />
        ))}
      </div>
    );
  };

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="w-full grid grid-cols-4">
        <TabsTrigger value="all" className="text-xs sm:text-sm">Todos ({allItems.length})</TabsTrigger>
        <TabsTrigger value="comments" className="text-xs sm:text-sm">Comentários ({commentItems.length})</TabsTrigger>
        <TabsTrigger value="status" className="text-xs sm:text-sm">Status ({statusItems.length})</TabsTrigger>
        <TabsTrigger value="time" className="text-xs sm:text-sm">Horas ({timeItems.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="mt-4">{renderList(allItems)}</TabsContent>
      <TabsContent value="comments" className="mt-4">{renderList(commentItems)}</TabsContent>
      <TabsContent value="status" className="mt-4">{renderList(statusItems)}</TabsContent>
      <TabsContent value="time" className="mt-4">{renderList(timeItems)}</TabsContent>
    </Tabs>
  );
};
