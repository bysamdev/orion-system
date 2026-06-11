import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, RefreshCw, Zap, ArrowRightLeft, AlertTriangle, Crown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTION_TYPES, useAutomationLogs } from '@/hooks/useAutomation';

const ACTION_ICONS: Record<string, React.ElementType> = {
  assign_tech: ArrowRightLeft,
  round_robin: RefreshCw,
  escalate_manager: AlertTriangle,
  set_priority: Crown,
  auto_response: MessageSquare,
  notify_all: Zap,
};

export const HistoryTab: React.FC = () => {
  const { data: logs = [], isLoading, refetch, isFetching } = useAutomationLogs();

  const renderActionIcon = (type: string) => {
    const Icon = ACTION_ICONS[type] || Zap;
    return <Icon className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Histórico de Execuções</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Atualiza automaticamente a cada 15 segundos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <History className="w-10 h-10 text-muted-foreground/30" />
            <div>
              <p className="font-bold">Nenhuma execução registrada</p>
              <p className="text-sm text-muted-foreground">As regras são executadas automaticamente quando um chamado é criado.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Quando</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Regra Disparada</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Ação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id} className="hover:bg-muted/10">
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs">{log.rule_name ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        {renderActionIcon(log.action_type)} {ACTION_TYPES.find(a => a.value === log.action_type)?.label ?? log.action_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.action_result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};
