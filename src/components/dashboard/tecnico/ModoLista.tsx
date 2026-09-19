import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, HandHelping, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { SLABadge } from '../SLABadge';
import { TimeAgoBadge } from './TimeAgoBadge';
import { FiltrosAvancados } from './FiltrosAvancados';
import { FiltrosDoPainel } from './useFiltrosDoPainel';

export type Recorte = 'fila' | 'meus' | 'sla' | 'todos';

const slaCritico = (t: Ticket) => t.sla_status === 'attention' || t.sla_status === 'breached';
const semResponsavel = (t: Ticket) => !t.assigned_to_user_id && !t.assigned_to;

interface ModoListaProps {
  filtros: FiltrosDoPainel;
  recorteInicial: Recorte;
  onAssume: (id: string) => void;
}

// Uma linha por chamado, filtros rápidos no topo e nada mais.
export const ModoLista: React.FC<ModoListaProps> = ({ filtros, recorteInicial, onAssume }) => {
  const navigate = useNavigate();
  const [recorte, setRecorte] = useState<Recorte>(recorteInicial);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const listas = useMemo(() => {
    // "Todos" já inclui a fila; a união cobre o caso de a fila chegar antes.
    const vistos = new Set<string>();
    const todos = [...filtros.filteredAllTickets, ...filtros.filteredUnassignedTickets].filter(t => {
      if (vistos.has(t.id)) return false;
      vistos.add(t.id);
      return true;
    });
    return {
      fila: filtros.filteredUnassignedTickets,
      meus: filtros.filteredMyTickets,
      sla: todos.filter(slaCritico),
      todos,
    };
  }, [filtros.filteredAllTickets, filtros.filteredUnassignedTickets, filtros.filteredMyTickets]);

  const chips: { id: Recorte; rotulo: string; perigo?: boolean }[] = [
    { id: 'fila', rotulo: 'Fila de espera' },
    { id: 'meus', rotulo: 'Meus chamados' },
    { id: 'sla', rotulo: 'SLA crítico', perigo: listas.sla.length > 0 },
    { id: 'todos', rotulo: 'Todos' },
  ];

  const chamados = listas[recorte];
  const mostraResponsavel = recorte !== 'fila' && recorte !== 'meus';

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Recorte da lista">
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={recorte === c.id}
              onClick={() => setRecorte(c.id)}
              className={cn(
                'inline-flex items-center gap-2 h-8 px-3 rounded-full border text-xs font-semibold transition-colors',
                recorte === c.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
              )}
            >
              {c.rotulo}
              <span
                className={cn(
                  'min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center text-[11px] tabular-nums',
                  recorte === c.id
                    ? 'bg-primary-foreground/20'
                    : c.perigo ? 'bg-destructive/15 text-destructive' : 'bg-muted'
                )}
              >
                {listas[c.id].length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            <Input
              autoComplete="off"
              placeholder="Buscar #número, título ou cliente"
              value={filtros.searchTerm}
              onChange={e => filtros.setSearchTerm(e.target.value)}
              className="pl-9 h-9 rounded-xl"
            />
          </div>
          <Button
            variant={filtrosAbertos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltrosAbertos(v => !v)}
            className="h-9 rounded-xl gap-1.5 text-xs font-semibold"
          >
            <Filter className="w-3.5 h-3.5" /> Filtros
          </Button>
        </div>
      </div>

      {filtrosAbertos && <FiltrosAvancados filtros={filtros} />}

      <div className="hidden md:block rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[76px] h-10 text-xs font-semibold">Nº</TableHead>
              <TableHead className="h-10 text-xs font-semibold">Chamado</TableHead>
              <TableHead className="w-[104px] h-10 text-xs font-semibold">Prioridade</TableHead>
              <TableHead className="w-[150px] h-10 text-xs font-semibold">Status</TableHead>
              {mostraResponsavel && <TableHead className="w-[150px] h-10 text-xs font-semibold">Responsável</TableHead>}
              <TableHead className="w-[130px] h-10 text-xs font-semibold">SLA</TableHead>
              <TableHead className="w-[120px] h-10 text-xs font-semibold">Aberto</TableHead>
              <TableHead className="w-[104px] h-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={mostraResponsavel ? 8 : 7} className="h-32 text-center text-sm text-muted-foreground">
                  {recorte === 'fila' && !filtros.temFiltroNaFila
                    ? 'Fila limpa. Nenhum chamado aguardando atendimento.'
                    : 'Nenhum chamado por aqui.'}
                </TableCell>
              </TableRow>
            ) : (
              chamados.map(t => (
                <TableRow
                  key={t.id}
                  onClick={() => navigate(`/ticket/${t.id}`)}
                  className="cursor-pointer group"
                >
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">#{t.ticket_number}</TableCell>
                  <TableCell className="py-2.5 max-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.requester_name}{t.company_name ? ` · ${t.company_name}` : ''}
                    </p>
                  </TableCell>
                  <TableCell className="py-2.5"><PriorityBadge priority={t.priority} size="sm" /></TableCell>
                  <TableCell className="py-2.5"><StatusBadge status={t.status} /></TableCell>
                  {mostraResponsavel && (
                    <TableCell className="py-2.5 text-xs text-muted-foreground truncate max-w-[150px]">
                      {t.assigned_to || <span className="italic">Sem responsável</span>}
                    </TableCell>
                  )}
                  <TableCell className="py-2.5">
                    <SLABadge slaStatus={t.sla_status} slaDueDate={t.sla_due_date} createdAt={t.created_at} variant="compact" />
                  </TableCell>
                  <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                    <TimeAgoBadge date={t.created_at} curto />
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    {semResponsavel(t) && (
                      <Button
                        size="sm"
                        onClick={e => { e.stopPropagation(); onAssume(t.id); }}
                        className="h-7 px-3 rounded-lg text-xs font-semibold gap-1"
                      >
                        <HandHelping className="w-3.5 h-3.5" /> Assumir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Celular: a tabela espreme o título; aqui cada chamado vira um cartão. */}
      <div className="md:hidden space-y-2">
        {chamados.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {recorte === 'fila' && !filtros.temFiltroNaFila
              ? 'Fila limpa. Nenhum chamado aguardando atendimento.'
              : 'Nenhum chamado por aqui.'}
          </p>
        ) : (
          chamados.map(t => (
            <div
              key={t.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/ticket/${t.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/ticket/${t.id}`); }}
              className="rounded-xl border border-border/60 bg-card p-3 space-y-2 cursor-pointer active:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{t.ticket_number}</span>
                <PriorityBadge priority={t.priority} size="sm" />
                <span className="ml-auto">
                  <SLABadge slaStatus={t.sla_status} slaDueDate={t.sla_due_date} createdAt={t.created_at} variant="compact" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{t.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t.requester_name}{t.company_name ? ` · ${t.company_name}` : ''}
                  {mostraResponsavel ? ` · ${t.assigned_to || 'Sem responsável'}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <span onClick={e => e.stopPropagation()}><TimeAgoBadge date={t.created_at} curto /></span>
                {semResponsavel(t) && (
                  <Button
                    size="sm"
                    onClick={e => { e.stopPropagation(); onAssume(t.id); }}
                    className="ml-auto h-7 px-3 rounded-lg text-xs font-semibold gap-1"
                  >
                    <HandHelping className="w-3.5 h-3.5" /> Assumir
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
