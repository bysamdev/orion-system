import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CircleMinus, History, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTION_TYPES, useAutomationLogs } from '@/hooks/useAutomation';
import { iconeDaAcao } from './fluxo';

interface Props {
  filtroEmpresa: string;
  nomesDasEmpresas: Map<string, string>;
}

// O motor grava "erro: ..." e "ignorado: ..." no resultado quando a ação não
// fez nada; o resto é sucesso. O ícone repete a informação da cor.
function situacao(resultado: string | null) {
  if (resultado?.startsWith('erro')) return { Icone: CircleAlert, cor: 'text-destructive', rotulo: 'Falhou' };
  if (resultado?.startsWith('ignorado')) return { Icone: CircleMinus, cor: 'text-muted-foreground', rotulo: 'Ignorada' };
  return { Icone: CheckCircle2, cor: 'text-emerald-600 dark:text-emerald-400', rotulo: 'Feita' };
}

// Histórico compartilhado: todo gestor com acesso vê as mesmas execuções
// (a RLS decide quais empresas).
export const HistoryTab: React.FC<Props> = ({ filtroEmpresa, nomesDasEmpresas }) => {
  const navigate = useNavigate();
  const { data: logs = [], isLoading, refetch, isFetching } = useAutomationLogs();
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace(/^#/, '');
    return logs.filter(l =>
      (filtroEmpresa === 'all' || l.tickets?.company_id === filtroEmpresa) &&
      (!termo ||
        l.rule_name?.toLowerCase().includes(termo) ||
        l.action_result?.toLowerCase().includes(termo) ||
        l.tickets?.title?.toLowerCase().includes(termo) ||
        String(l.tickets?.ticket_number ?? '').includes(termo))
    );
  }, [logs, busca, filtroEmpresa]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Histórico de execuções</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Cada ação que uma regra executou, com o chamado e o resultado. Atualiza a cada 15 segundos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Regra, chamado ou resultado"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" /></div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-14 text-center space-y-2">
          <History className="w-8 h-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium">{logs.length === 0 ? 'Nenhuma regra disparou ainda' : 'Nada com esse filtro'}</p>
          <p className="text-xs text-muted-foreground">
            {logs.length === 0 ? 'Quando um chamado aberto casar com uma regra ativa, a execução aparece aqui.' : 'Mude a busca ou a empresa.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[130px] text-xs font-semibold">Quando</TableHead>
                <TableHead className="text-xs font-semibold">Chamado</TableHead>
                <TableHead className="text-xs font-semibold">Regra</TableHead>
                <TableHead className="w-[210px] text-xs font-semibold">Ação</TableHead>
                <TableHead className="text-xs font-semibold">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map(l => {
                const data = new Date(l.created_at);
                const Icone = iconeDaAcao(l.action_type);
                const s = situacao(l.action_result);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap" title={format(data, "dd/MM/yyyy 'às' HH:mm:ss")}>
                      {formatDistanceToNow(data, { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell className="py-2.5 max-w-[240px]">
                      {l.tickets ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/ticket/${l.ticket_id}`)}
                          className="text-left min-w-0 max-w-full hover:text-primary"
                        >
                          <span className="block text-sm font-medium truncate">#{l.tickets.ticket_number} {l.tickets.title}</span>
                          <span className="block text-xs text-muted-foreground truncate">{nomesDasEmpresas.get(l.tickets.company_id ?? '') ?? ''}</span>
                        </button>
                      ) : <span className="text-xs text-muted-foreground">Chamado removido</span>}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm">{l.rule_name ?? 'Regra removida'}</TableCell>
                    <TableCell className="py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                        {ACTION_TYPES.find(a => a.value === l.action_type)?.label ?? l.action_type}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs', s.cor)}>
                        <s.Icone className="w-3.5 h-3.5 shrink-0" aria-label={s.rotulo} />
                        <span className="text-foreground/80">{l.action_result}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
