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
}

type Coluna = 'fila' | 'atendimento' | 'aguardando';

const COLUNAS: { id: Coluna; titulo: string; dica: string; ponto: string }[] = [
  { id: 'fila', titulo: 'Na fila', dica: 'Sem responsável', ponto: 'bg-sky-500' },
  { id: 'atendimento', titulo: 'Em atendimento', dica: 'Com responsável', ponto: 'bg-cyan-500' },
  { id: 'aguardando', titulo: 'Aguardando', dica: 'Cliente ou terceiro', ponto: 'bg-violet-500' },
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
// quem espera resposta de fora. Os fechados há pouco ficam na última coluna.
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
        </Button>
      </div>

      {filtrosAbertos && <FiltrosAvancados filtros={filtros} />}

      <div
        id="tickets-section"
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-mt-6 lg:grid lg:grid-cols-4 lg:overflow-visible"
      >
        {colunas.map(c => (
          <section
            key={c.id}
            aria-label={c.titulo}
            className="snap-start shrink-0 w-[85vw] sm:w-[340px] lg:w-auto rounded-2xl bg-muted/40 border border-border/50 p-2.5 space-y-2.5 min-w-0"
          >
            <header className="flex items-center gap-2 px-1.5 pt-1">
              <span className={cn('w-2 h-2 rounded-full', c.ponto)} />
              <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
              <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground bg-background/70 rounded-full px-2 py-0.5">
                {c.chamados.length}
              </span>
            </header>
            <p className="px-1.5 -mt-1.5 text-xs text-muted-foreground">{c.dica}</p>
            <div className="space-y-2.5">
              {c.chamados.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Nada aqui.</p>
              ) : (
                c.chamados.map(t => <CartaoDeChamado key={t.id} ticket={t} onAssume={onAssume} variante="cartao" />)
              )}
            </div>
          </section>
        ))}

        <section
          id="closed-tickets-section"
          aria-label="Fechados recentemente"
          className="snap-start shrink-0 w-[85vw] sm:w-[340px] lg:w-auto rounded-2xl border border-dashed border-border/70 p-2.5 space-y-2.5 min-w-0 scroll-mt-6"
        >
          <header className="flex items-center gap-2 px-1.5 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">Fechados há pouco</h3>
          </header>
          <div className="space-y-1.5">
            {recentClosed.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Nenhum ainda.</p>
            ) : (
              recentClosed.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/ticket/${t.id}`)}
                  className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors"
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
