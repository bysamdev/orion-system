import React, { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { FiltrosAvancados } from './FiltrosAvancados';
import { FiltrosDoPainel } from './useFiltrosDoPainel';
import { CartaoDeChamado } from './CartaoDeChamado';
import { Secao, secaoDe } from './identidade';

export type Recorte = 'fila' | 'meus' | 'todos';

// Seções pela situação do atendimento. O prazo de cada chamado aparece no
// selo colorido do cartão (verde, laranja, vermelho, roxo quando pausado).
const SECOES: { id: Secao; titulo: string; dica: string; ponto: string }[] = [
  { id: 'fila', titulo: 'Na fila', dica: 'aguardando um técnico', ponto: 'bg-sky-500' },
  { id: 'em_atendimento', titulo: 'Em atendimento', dica: 'sendo atendidos agora', ponto: 'bg-amber-500' },
  { id: 'atendido', titulo: 'Atendido', dica: 'pausados ou aguardando conclusão do atendimento', ponto: 'bg-violet-500' },
  { id: 'concluido', titulo: 'Atendimento concluído', dica: 'fechados nos últimos 7 dias', ponto: 'bg-emerald-500' },
];

const vencimento = (t: Ticket) => (t.sla_due_date ? new Date(t.sla_due_date).getTime() : Infinity);
const maisRecenteAntes = (a: Ticket, b: Ticket) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '');

interface ModoListaProps {
  filtros: FiltrosDoPainel;
  recorteInicial: Recorte | 'sla';
  userId?: string;
  onAssume: (id: string) => void;
}

// Chamados agrupados pela situação do atendimento, um cartão largo por chamado.
export const ModoLista: React.FC<ModoListaProps> = ({ filtros, recorteInicial, userId, onAssume }) => {
  const [recorte, setRecorte] = useState<Recorte>(recorteInicial === 'sla' ? 'todos' : recorteInicial);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Ativos contam nos botões; concluídos só aparecem na última seção.
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
      todos,
    };
  }, [filtros.filteredAllTickets, filtros.filteredUnassignedTickets, filtros.filteredMyTickets]);

  const concluidos = useMemo(() => ({
    fila: [] as Ticket[],
    meus: filtros.filteredClosedTickets.filter(t => t.assigned_to_user_id === userId),
    todos: filtros.filteredClosedTickets,
  }), [filtros.filteredClosedTickets, userId]);

  const chips: { id: Recorte; rotulo: string }[] = [
    { id: 'fila', rotulo: 'Fila de espera' },
    { id: 'meus', rotulo: 'Meus chamados' },
    { id: 'todos', rotulo: 'Todos' },
  ];

  const chamados = useMemo(
    () => [...listas[recorte], ...concluidos[recorte]],
    [listas, concluidos, recorte]
  );

  const grupos = useMemo(() => SECOES
    .map(s => ({
      ...s,
      chamados: chamados
        .filter(t => secaoDe(t) === s.id)
        .sort(s.id === 'concluido' ? maisRecenteAntes : (a, b) => vencimento(a) - vencimento(b)),
    }))
    .filter(s => s.chamados.length > 0), [chamados]);

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
                    : 'bg-muted'
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
