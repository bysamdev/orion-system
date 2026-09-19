import React, { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { FiltrosAvancados } from './FiltrosAvancados';
import { FiltrosDoPainel } from './useFiltrosDoPainel';
import { CartaoDeChamado } from './CartaoDeChamado';
import { Urgencia, urgenciaDe } from './identidade';

export type Recorte = 'fila' | 'meus' | 'sla' | 'todos';

const slaCritico = (t: Ticket) => {
  const u = urgenciaDe(t);
  return u === 'atrasado' || u === 'atencao';
};

// Ordem de leitura: o que já estourou primeiro, o que está parado por último.
const GRUPOS: { id: Urgencia; titulo: string; dica: string; ponto: string }[] = [
  { id: 'atrasado', titulo: 'Atrasados', dica: 'prazo de SLA vencido', ponto: 'bg-red-500' },
  { id: 'atencao', titulo: 'Precisam de atenção', dica: 'prazo perto do fim', ponto: 'bg-orange-500' },
  { id: 'em_dia', titulo: 'Em dia', dica: 'dentro do prazo', ponto: 'bg-emerald-500' },
  { id: 'pausado', titulo: 'Aguardando', dica: 'cliente ou terceiro, SLA pausado', ponto: 'bg-violet-500' },
];

const vencimento = (t: Ticket) => (t.sla_due_date ? new Date(t.sla_due_date).getTime() : Infinity);

interface ModoListaProps {
  filtros: FiltrosDoPainel;
  recorteInicial: Recorte;
  onAssume: (id: string) => void;
}

// Chamados agrupados por urgência, um cartão largo por chamado.
export const ModoLista: React.FC<ModoListaProps> = ({ filtros, recorteInicial, onAssume }) => {
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

  const grupos = useMemo(() => GRUPOS
    .map(g => ({
      ...g,
      chamados: chamados.filter(t => urgenciaDe(t) === g.id).sort((a, b) => vencimento(a) - vencimento(b)),
    }))
    .filter(g => g.chamados.length > 0), [chamados]);

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
            {filtros.temFiltro && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-current" aria-label="filtros ativos" />}
          </Button>
        </div>
      </div>

      {filtrosAbertos && <FiltrosAvancados filtros={filtros} />}

      {chamados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-14 text-center">
          <p className="text-sm font-medium text-foreground">
            {recorte === 'fila' && !filtros.temFiltroNaFila ? 'Fila limpa' : 'Nenhum chamado por aqui'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {recorte === 'fila' && !filtros.temFiltroNaFila
              ? 'Nenhum chamado aguardando atendimento.'
              : 'Tente outro recorte ou limpe a busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(g => (
            <section key={g.id} aria-label={g.titulo} className="space-y-1.5">
              <header className="flex items-center gap-2 px-1">
                <span className={cn('w-2 h-2 rounded-full', g.ponto)} />
                <h3 className="text-sm font-semibold text-foreground">{g.titulo}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{g.chamados.length}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">· {g.dica}</span>
              </header>
              <div className="space-y-1.5">
                {g.chamados.map(t => (
                  <CartaoDeChamado key={t.id} ticket={t} onAssume={onAssume} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
