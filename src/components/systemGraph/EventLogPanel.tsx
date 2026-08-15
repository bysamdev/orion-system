import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSystemGraphStore } from '@/lib/systemGraph/store';

const STATUS_DOT: Record<string, string> = {
  processing: 'bg-amber-400',
  success: 'bg-green-500',
  error: 'bg-red-500',
};

export function EventLogPanel() {
  const eventLog = useSystemGraphStore(s => s.eventLog);

  return (
    <div className="w-72 border-l border-border/40 flex flex-col">
      <div className="px-4 py-3 border-b border-border/40">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Eventos recentes
        </h2>
      </div>
      <ScrollArea className="flex-1">
        {eventLog.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">Aguardando eventos…</p>
        ) : (
          <ul className="divide-y divide-border/20">
            {eventLog.map(evt => (
              <li key={evt.id} className="px-4 py-2 flex items-center gap-2 text-xs">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[evt.status])} />
                <span className="flex-1 truncate">{evt.edge_id}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(evt.timestamp), { locale: ptBR, addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
