import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArchNode, ARCH_EDGES } from '@/lib/systemGraph/architecture';
import { useSystemGraphStore } from '@/lib/systemGraph/store';

interface NodeDetailsSheetProps {
  node: ArchNode | null;
  open: boolean;
  onClose: () => void;
}

export function NodeDetailsSheet({ node, open, onClose }: NodeDetailsSheetProps) {
  const eventLog = useSystemGraphStore(s => s.eventLog);

  const connectedEdges = node
    ? ARCH_EDGES.filter(e => e.source === node.id || e.target === node.id)
    : [];
  const recentEvents = node
    ? eventLog.filter(evt => connectedEdges.some(e => e.id === evt.edge_id)).slice(0, 10)
    : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {node && (
          <>
            <SheetHeader>
              <SheetTitle>{node.label}</SheetTitle>
              <SheetDescription>{node.description}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {node.sourceRef && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Referência no código</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{node.sourceRef}</code>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Conexões ({connectedEdges.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {connectedEdges.map(e => (
                    <Badge key={e.id} variant="outline" className="text-[10px]">
                      {e.source === node.id ? `→ ${e.target}` : `← ${e.source}`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Eventos recentes
                </p>
                <ScrollArea className="h-40">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento recente.</p>
                  ) : (
                    <ul className="space-y-1">
                      {recentEvents.map(evt => (
                        <li key={evt.id} className="text-xs flex justify-between">
                          <span>{evt.edge_id}</span>
                          <span className="text-muted-foreground">{evt.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
