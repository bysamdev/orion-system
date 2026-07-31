import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Clock, MessageSquare, RotateCcw, Timer, Lock, User, AlertCircle,
  History, Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
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

type EventType =
  | 'comment'
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'status_history'
  | 'time_entry';

type TimelineItem = {
  id: string;
  type: EventType;
  author: string;
  content: string;
  created_at: string;
  isInternal?: boolean;
  meta?: Record<string, unknown>;
};

const statusLabels: Record<string, string> = {
  'open': 'Aberto', 'in-progress': 'Em Andamento', 'awaiting-customer': 'Aguard. Cliente',
  'awaiting-third-party': 'Aguard. Terceiro', 'resolved': 'Resolvido', 'closed': 'Fechado',
  'reopened': 'Reaberto', 'cancelled': 'Cancelado',
};

const EVENT_META: Record<EventType, { label: string; color: string; iconColor: string; badgeClass: string }> = {
  comment: {
    label: 'Comentário',
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  },
  status_change: {
    label: 'Status',
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700',
  },
  status_history: {
    label: 'Status',
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700',
  },
  assignment: {
    label: 'Atribuição',
    color: 'bg-violet-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700',
  },
  priority_change: {
    label: 'Prioridade',
    color: 'bg-orange-500/15',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  },
  time_entry: {
    label: 'Apontamento',
    color: 'bg-primary/10',
    iconColor: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
  },
};

const TimelineItemIcon: React.FC<{ type: EventType; isInternal?: boolean }> = ({ type, isInternal }) => {
  if (isInternal) return <Lock className="w-3.5 h-3.5 text-amber-600" />;
  switch (type) {
    case 'status_change':
    case 'status_history': return <RotateCcw className="w-3.5 h-3.5" />;
    case 'assignment':     return <User className="w-3.5 h-3.5" />;
    case 'priority_change': return <AlertCircle className="w-3.5 h-3.5" />;
    case 'time_entry':     return <Timer className="w-3.5 h-3.5" />;
    default:               return <MessageSquare className="w-3.5 h-3.5" />;
  }
};

/**
 * Builds a deduplicated, time-sorted timeline.
 * ticket_updates of type status_change that match a ticket_status_history
 * entry (same 60s window) are kept only once (prefer ticket_updates entry).
 */
const buildTimeline = (
  updates: TicketUpdate[],
  statusHistory: StatusHistoryEntry[],
  timeEntries: TimeEntry[],
): TimelineItem[] => {
  const items: TimelineItem[] = [];

  // Find status_history entries covered by a ticket_update status_change
  const coveredStatusIds = new Set<string>();
  statusHistory.forEach(sh => {
    const shTime = new Date(sh.created_at).getTime();
    const isDuplicated = updates.some(u => {
      if (u.type !== 'status_change') return false;
      return Math.abs(new Date(u.created_at).getTime() - shTime) < 60_000;
    });
    if (isDuplicated) coveredStatusIds.add(sh.id);
  });

  updates.forEach(u => {
    items.push({
      id: u.id,
      type: u.type as EventType,
      author: u.author,
      content: u.content,
      created_at: u.created_at,
      isInternal: u.is_internal,
    });
  });

  statusHistory.forEach(sh => {
    if (coveredStatusIds.has(sh.id)) return;
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
      author: te.user_id,
      content: te.description || 'Apontamento de horas',
      created_at: te.start_time,
      meta: { duration: durationStr, billable: te.billable, running: !te.end_time },
    });
  });

  items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return items;
};

const TimelineEntry: React.FC<{ item: TimelineItem; isLast: boolean }> = ({ item, isLast }) => {
  const eventMeta = item.isInternal
    ? { color: 'bg-amber-500/15', iconColor: 'text-amber-600' }
    : EVENT_META[item.type] ?? EVENT_META.comment;

  const formattedDate = item.created_at && !isNaN(new Date(item.created_at).getTime())
    ? format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '';

  const relativeDate = item.created_at && !isNaN(new Date(item.created_at).getTime())
    ? formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })
    : '';

  const isSystemEvent = ['status_change', 'status_history', 'assignment', 'priority_change'].includes(item.type);

  return (
    <div className="flex gap-3 md:gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', eventMeta.color)}>
          <span className={eventMeta.iconColor}>
            <TimelineItemIcon type={item.type} isInternal={item.isInternal} />
          </span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border/50 mt-2" />}
      </div>

      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-medium text-foreground text-sm truncate max-w-[200px]">{item.author}</span>

            {/* Semantic event type badge */}
            {!item.isInternal && EVENT_META[item.type] && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0',
                  EVENT_META[item.type].badgeClass,
                )}
              >
                {EVENT_META[item.type].label}
              </Badge>
            )}

            {item.isInternal && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
                <Lock className="w-3 h-3 mr-1" />Nota Interna
              </Badge>
            )}

            {item.type === 'time_entry' && item.meta && (
              <Badge variant="outline" className="text-xs gap-1">
                <Timer className="w-3 h-3" />
                {item.meta.running ? 'Em andamento' : String(item.meta.duration)}
                {item.meta.billable && ' • Faturável'}
              </Badge>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default shrink-0 hover:text-foreground transition-colors">
                {relativeDate}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">{formattedDate}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {isSystemEvent ? (
          <p className="text-sm text-muted-foreground italic flex items-center gap-1.5">
            {(item.type === 'status_history' || item.type === 'status_change') && (
              <RotateCcw className="w-3 h-3 shrink-0" />
            )}
            {item.type === 'assignment' && <User className="w-3 h-3 shrink-0" />}
            {item.type === 'priority_change' && <AlertCircle className="w-3 h-3 shrink-0" />}
            {item.content}
          </p>
        ) : (
          <p className={cn(
            'text-sm leading-relaxed break-words whitespace-pre-wrap',
            item.isInternal
              ? 'text-foreground bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'
              : 'text-foreground bg-muted/30 rounded-lg p-3',
          )}>
            {item.content}
          </p>
        )}

        {item.meta?.reason && (
          <p className="text-xs text-muted-foreground mt-1.5 italic">
            Motivo: {String(item.meta.reason)}
          </p>
        )}
      </div>
    </div>
  );
};

const EmptyTab: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
    <Inbox className="w-8 h-8 opacity-30" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({
  updates,
  statusHistory = [],
  timeEntries = [],
}) => {
  const allItems = buildTimeline(updates, statusHistory, timeEntries);
  const commentItems = allItems.filter(i => i.type === 'comment');
  // "Histórico" consolidates all system-generated change events
  const historyItems = allItems.filter(i =>
    ['status_change', 'status_history', 'assignment', 'priority_change'].includes(i.type),
  );
  const timeItems = allItems.filter(i => i.type === 'time_entry');

  const renderList = (items: TimelineItem[], emptyMsg: string) => {
    if (items.length === 0) return <EmptyTab label={emptyMsg} />;
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
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          <Clock className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
          Todos ({allItems.length})
        </TabsTrigger>
        <TabsTrigger value="comments" className="text-xs sm:text-sm">
          <MessageSquare className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
          Comentários ({commentItems.length})
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs sm:text-sm">
          <History className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
          Histórico ({historyItems.length})
        </TabsTrigger>
        <TabsTrigger value="time" className="text-xs sm:text-sm">
          <Timer className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
          Horas ({timeItems.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        {renderList(allItems, 'Nenhuma atividade registrada ainda.')}
      </TabsContent>
      <TabsContent value="comments" className="mt-4">
        {renderList(commentItems, 'Nenhum comentário ainda. Seja o primeiro!')}
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        {renderList(historyItems, 'Nenhuma alteração de status, atribuição ou prioridade registrada.')}
      </TabsContent>
      <TabsContent value="time" className="mt-4">
        {renderList(timeItems, 'Nenhum apontamento de horas registrado.')}
      </TabsContent>
    </Tabs>
  );
};
