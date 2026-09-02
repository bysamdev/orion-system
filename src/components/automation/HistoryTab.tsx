import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, RefreshCw, Zap, ArrowRightLeft, AlertTriangle, Crown, MessageSquare, Search, Clock, Activity, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTION_TYPES, useAutomationLogs } from '@/hooks/useAutomation';
import { useProfilesMap, replaceUserUuidsInText } from '@/hooks/useUserDisplayName';

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
  const { profilesMap } = useProfilesMap();
  const [searchQuery, setSearchQuery] = useState('');

  const renderActionIcon = (type: string) => {
    const Icon = ACTION_ICONS[type] || Zap;
    return <Icon className="w-3.5 h-3.5 shrink-0" />;
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(log =>
      (log.rule_name && log.rule_name.toLowerCase().includes(query)) ||
      (log.action_type && log.action_type.toLowerCase().includes(query)) ||
      (log.action_result && log.action_result.toLowerCase().includes(query))
    );
  }, [logs, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header com Busca e Atualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-4 rounded-2xl border border-border/40 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight text-foreground">Histórico de Execuções</h2>
          </div>
          <p className="text-xs text-muted-foreground">Registro cronológico de todas as automações disparadas na plataforma (atualização periódica a cada 15s).</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar no histórico..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background/60"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 h-9 rounded-xl font-medium"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs text-muted-foreground">Carregando histórico de execuções...</p>
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner">
              <History className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground text-base">Nenhuma execução registrada</p>
              <p className="text-xs text-muted-foreground max-w-md">As regras de automação são executadas de forma transparente no momento em que novos chamados são criados.</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-semibold text-sm text-foreground">Nenhum evento encontrado</p>
            <p className="text-xs text-muted-foreground">Tente buscar por outro termo ou limpe o filtro.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden rounded-2xl shadow-xs">
          <ScrollArea className="h-[520px]">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-md z-10">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-40">Horário</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Regra Disparada</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-48">Ação Executada</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => {
                  const dateObj = new Date(log.created_at);
                  const isValidDate = !isNaN(dateObj.getTime());
                  const relativeTime = isValidDate
                    ? formatDistanceToNow(dateObj, { locale: ptBR, addSuffix: true })
                    : '—';
                  const exactTime = isValidDate
                    ? format(dateObj, "dd/MM/yyyy 'às' HH:mm:ss")
                    : '—';

                  return (
                    <TableRow key={log.id} className="border-border/30 hover:bg-muted/20 transition-colors">
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap" title={exactTime}>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3 h-3 text-muted-foreground/60" />
                          <span>{relativeTime}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-foreground">{log.rule_name ?? 'Regra Sem Nome'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                          {renderActionIcon(log.action_type)}
                          <span>{ACTION_TYPES.find(a => a.value === log.action_type)?.label ?? log.action_type}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-normal leading-relaxed">
                        {replaceUserUuidsInText(log.action_result, profilesMap)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};

