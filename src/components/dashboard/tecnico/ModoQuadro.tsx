import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { CartaoDeChamado } from './CartaoDeChamado';
import { FiltrosAvancados } from './FiltrosAvancados';
import { FiltrosDoPainel } from './useFiltrosDoPainel';
import { semResponsavel } from './identidade';

export interface ChamadoFechado {
  id: string;
  ticket_number: number;
  title: string;
  requester_name?: string | null;
  category?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
}

// Os fechados passam pelos filtros que fazem sentido para eles. Status,
// prazo, empresa e os cartões de números descrevem chamados abertos: com um
// deles ligado, nenhum fechado atende, e a coluna fica vazia.
function filtrarFechados(fechados: ChamadoFechado[], f: FiltrosDoPainel): ChamadoFechado[] {
  if (f.kpiFilter || f.statusFilter !== 'all' || f.slaFilter !== 'all' || f.companyFilter !== 'all') return [];
  const busca = f.searchTerm.toLowerCase().replace(/^#/, '');
  return fechados.filter(t =>
    (f.priorityFilter === 'all' || t.priority === f.priorityFilter) &&
    (f.categoryFilter === 'all' || t.category === f.categoryFilter) &&
    (f.technicianFilter === 'all' || t.assigned_to === f.technicianFilter) &&
    (!busca ||
      t.title.toLowerCase().includes(busca) ||
      t.ticket_number.toString().includes(busca) ||
      !!t.requester_name?.toLowerCase().includes(busca))
  );
}

type Coluna = 'fila' | 'atendimento' | 'aguardando';

const COLUNAS: { id: Coluna; titulo: string; dica: string; ponto: string }[] = [
  { id: 'fila', titulo: 'Na fila', dica: 'sem responsável', ponto: 'bg-sky-500' },
  { id: 'atendimento', titulo: 'Em atendimento', dica: 'com responsável', ponto: 'bg-cyan-500' },
  { id: 'aguardando', titulo: 'Aguardando', dica: 'cliente ou terceiro', ponto: 'bg-violet-500' },
];

const AGUARDANDO = ['awaiting-customer', 'awaiting-third-party'];

function colunaDe(t: Ticket): Coluna {
  if (AGUARDANDO.includes(t.status)) return 'aguardando';
  return semResponsavel(t) ? 'fila' : 'atendimento';
}

const vencimento = (t: Ticket) => (t.sla_due_date ? new Date(t.sla_due_date).getTime() : Infinity);

interface ModoQuadroProps {
  filtros: FiltrosDoPainel;
  filtrosAbertos: boolean;
  onAlternarFiltros: () => void;
  recentClosed: ChamadoFechado[];
  onAssume: (id: string) => void;
}

// Um quadro por situação do chamado: quem está na fila, quem já tem dono e
// quem espera resposta de fora. Os fechados há pouco ficam na última coluna
// em telas largas (2xl) e numa faixa abaixo do quadro nas médias, para não
// roubar largura dos cartões.
export const ModoQuadro: React.FC<ModoQuadroProps> = ({ filtros, filtrosAbertos, onAlternarFiltros, recentClosed, onAssume }) => {
  const navigate = useNavigate();

  const colunas = useMemo(() => {
    const vistos = new Set<string>();
    const todos = [...filtros.filteredAllTickets, ...filtros.filteredUnassignedTickets].filter(t => {
      if (vistos.has(t.id)) return false;
      vistos.add(t.id);
      return true;
    });
    return COLUNAS.map(c => ({
      ...c,
      chamados: todos.filter(t => colunaDe(t) === c.id).sort((a, b) => vencimento(a) - vencimento(b)),
    }));
  }, [filtros.filteredAllTickets, filtros.filteredUnassignedTickets]);

  const fechados = useMemo(() => filtrarFechados(recentClosed, filtros), [recentClosed, filtros]);
  const quantosFiltros = [filtros.priorityFilter, filtros.statusFilter, filtros.categoryFilter, filtros.slaFilter, filtros.technicianFilter, filtros.companyFilter]
    .filter(v => v !== 'all').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:max-w-md">
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
          onClick={onAlternarFiltros}
          className="h-9 rounded-xl gap-1.5 text-xs font-semibold"
        >
          <Filter className="w-3.5 h-3.5" /> Filtros
          {quantosFiltros > 0 && (
            <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-primary-foreground/25 text-[11px] leading-4 tabular-nums">{quantosFiltros}</span>
          )}
        </Button>
      </div>

      {filtrosAbertos && <FiltrosAvancados filtros={filtros} />}

      <div
        id="tickets-section"
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-mt-6 lg:grid lg:grid-cols-3 2xl:grid-cols-[repeat(3,minmax(0,1fr))_220px] lg:overflow-visible items-start"
      >
        {colunas.map(c => (
          <section
            key={c.id}
            aria-label={c.titulo}
            className="snap-start shrink-0 w-[85vw] sm:w-[320px] lg:w-auto rounded-xl bg-muted/40 border border-border/50 p-2 space-y-2 min-w-0"
          >
            <header className="flex items-center gap-2 px-1.5 py-1 min-w-0">
              <span className={cn('w-2 h-2 rounded-full shrink-0', c.ponto)} aria-hidden />
              <h3 className="text-sm font-semibold text-foreground whitespace-nowrap">{c.titulo}</h3>
              <span className="text-xs text-muted-foreground truncate lg:hidden 2xl:inline">{c.dica}</span>
              <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground bg-background/70 rounded-full px-2 py-0.5 shrink-0">
                {c.chamados.length}
              </span>
            </header>
            <div className="space-y-2">
              {c.chamados.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nada aqui.</p>
              ) : (
                c.chamados.map(t => <CartaoDeChamado key={t.id} ticket={t} onAssume={onAssume} variante="cartao" />)
              )}
            </div>
          </section>
        ))}

        <section
          id="closed-tickets-section"
          aria-label="Fechados recentemente"
          className="snap-start shrink-0 w-[85vw] sm:w-[320px] lg:w-auto lg:col-span-3 2xl:col-span-1 rounded-xl border border-dashed border-border/70 p-2 space-y-2 min-w-0 scroll-mt-6"
        >
          <header className="flex items-center gap-2 px-1.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">Fechados há pouco</h3>
          </header>
          <div className="space-y-0.5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-x-2 2xl:block 2xl:space-y-0.5">
            {fechados.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{recentClosed.length === 0 ? 'Nenhum ainda.' : 'Nenhum com esses filtros.'}</p>
            ) : (
              fechados.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/ticket/${t.id}`)}
                  className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</p>
                  <p className="text-sm text-foreground/80 line-through decoration-muted-foreground/40 truncate">{t.title}</p>
                </button>
              ))
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/historico')}
            className="w-full text-xs font-medium text-muted-foreground hover:text-primary rounded-lg"
          >
            Ver histórico completo
          </Button>
        </section>
      </div>
    </div>
  );
};
