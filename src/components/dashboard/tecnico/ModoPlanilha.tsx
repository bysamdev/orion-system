import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getPriorityLabel } from '@/lib/state-tokens';
import type { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { FiltrosDoPainel } from './useFiltrosDoPainel';
import { COR_DO_PRAZO, categoriaDe, prazoDe } from './identidade';

// Planilha de chamados: o usuário arrasta a borda do cabeçalho para mudar a
// largura, arrasta o cabeçalho para trocar a coluna de lugar e escolhe a
// altura das linhas. O arranjo fica salvo por usuário neste navegador.

type IdDaColuna =
  | 'numero' | 'titulo' | 'status' | 'prioridade' | 'categoria' | 'solicitante'
  | 'empresa' | 'responsavel' | 'prazo' | 'aberto' | 'atualizado';

interface Coluna {
  id: IdDaColuna;
  titulo: string;
  largura: number;
  celula: (t: Ticket) => React.ReactNode;
  ordem: (t: Ticket) => string | number;
}

const PESO_PRIORIDADE: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const data = (v: string | null | undefined) => (v ? format(new Date(v), 'dd/MM/yy HH:mm') : '—');

const COLUNAS: Coluna[] = [
  { id: 'numero', titulo: 'Nº', largura: 80, celula: t => <span className="font-mono">#{t.ticket_number}</span>, ordem: t => t.ticket_number },
  { id: 'titulo', titulo: 'Título', largura: 320, celula: t => <span className="font-semibold">{t.title}</span>, ordem: t => t.title.toLowerCase() },
  { id: 'status', titulo: 'Status', largura: 150, celula: t => <StatusBadge status={t.status} className="max-w-full" />, ordem: t => t.status },
  { id: 'prioridade', titulo: 'Prioridade', largura: 110, celula: t => getPriorityLabel(t.priority), ordem: t => PESO_PRIORIDADE[t.priority] ?? 9 },
  { id: 'categoria', titulo: 'Categoria', largura: 150, celula: t => categoriaDe(t.category).rotulo, ordem: t => categoriaDe(t.category).rotulo },
  { id: 'solicitante', titulo: 'Solicitante', largura: 170, celula: t => t.requester_name, ordem: t => (t.requester_name ?? '').toLowerCase() },
  { id: 'empresa', titulo: 'Empresa', largura: 170, celula: t => t.company_name ?? '—', ordem: t => (t.company_name ?? '').toLowerCase() },
  { id: 'responsavel', titulo: 'Responsável', largura: 170, celula: t => t.assigned_to ?? 'Sem responsável', ordem: t => (t.assigned_to ?? '').toLowerCase() },
  {
    id: 'prazo', titulo: 'Prazo', largura: 190,
    celula: t => {
      const p = prazoDe(t);
      return <span className={cn('inline-flex max-w-full h-6 items-center px-2 rounded-full border text-xs font-semibold truncate', COR_DO_PRAZO[p.tom])}>{p.texto}</span>;
    },
    ordem: t => (t.sla_due_date ? new Date(t.sla_due_date).getTime() : Infinity),
  },
  { id: 'aberto', titulo: 'Aberto em', largura: 130, celula: t => data(t.created_at), ordem: t => t.created_at },
  { id: 'atualizado', titulo: 'Atualizado em', largura: 130, celula: t => data(t.updated_at), ordem: t => t.updated_at ?? '' },
];

const POR_ID = new Map(COLUNAS.map(c => [c.id, c]));
const LARGURA_MINIMA = 60;

type Altura = 'compacta' | 'normal' | 'alta';
const ALTURAS: { id: Altura; rotulo: string; classe: string }[] = [
  { id: 'compacta', rotulo: 'Compacta', classe: 'h-8' },
  { id: 'normal', rotulo: 'Normal', classe: 'h-11' },
  { id: 'alta', rotulo: 'Alta', classe: 'h-16' },
];

interface Arranjo {
  ordem: IdDaColuna[];
  larguras: Partial<Record<IdDaColuna, number>>;
  altura: Altura;
}

const ARRANJO_PADRAO: Arranjo = { ordem: COLUNAS.map(c => c.id), larguras: {}, altura: 'normal' };

function lerArranjo(chave: string): Arranjo {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? 'null') as Arranjo | null;
    if (!salvo) return ARRANJO_PADRAO;
    // Descarta colunas que não existem mais e acrescenta as novas no fim.
    const ordem = salvo.ordem.filter(id => POR_ID.has(id));
    for (const c of COLUNAS) if (!ordem.includes(c.id)) ordem.push(c.id);
    return { ordem, larguras: salvo.larguras ?? {}, altura: ALTURAS.some(a => a.id === salvo.altura) ? salvo.altura : 'normal' };
  } catch {
    return ARRANJO_PADRAO;
  }
}

interface ModoPlanilhaProps {
  filtros: FiltrosDoPainel;
  userId?: string;
}

export const ModoPlanilha: React.FC<ModoPlanilhaProps> = ({ filtros, userId }) => {
  const navigate = useNavigate();
  const chave = `orion.painel.planilha.${userId ?? 'anonimo'}`;
  const [arranjo, setArranjo] = useState<Arranjo>(() => lerArranjo(chave));
  const [ordenacao, setOrdenacao] = useState<{ id: IdDaColuna; asc: boolean } | null>(null);
  const [arrastando, setArrastando] = useState<IdDaColuna | null>(null);
  const redimensionando = useRef(false);

  useEffect(() => { setArranjo(lerArranjo(chave)); }, [chave]);

  const salvar = useCallback((novo: Arranjo) => {
    setArranjo(novo);
    try { localStorage.setItem(chave, JSON.stringify(novo)); } catch { /* sem armazenamento: vale só nesta sessão */ }
  }, [chave]);

  const chamados = useMemo(() => {
    const vistos = new Set<string>();
    const todos = [...filtros.filteredAllTickets, ...filtros.filteredUnassignedTickets, ...filtros.filteredClosedTickets]
      .filter(t => (vistos.has(t.id) ? false : (vistos.add(t.id), true)));
    if (!ordenacao) return todos;
    const col = POR_ID.get(ordenacao.id)!;
    return [...todos].sort((a, b) => {
      const va = col.ordem(a), vb = col.ordem(b);
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return ordenacao.asc ? r : -r;
    });
  }, [filtros.filteredAllTickets, filtros.filteredUnassignedTickets, filtros.filteredClosedTickets, ordenacao]);

  const colunas = arranjo.ordem.map(id => POR_ID.get(id)!);
  const larguraDe = (c: Coluna) => arranjo.larguras[c.id] ?? c.largura;
  const classeDaAltura = ALTURAS.find(a => a.id === arranjo.altura)!.classe;

  const iniciarRedimensionamento = (e: React.PointerEvent, c: Coluna) => {
    e.preventDefault();
    e.stopPropagation();
    redimensionando.current = true;
    const inicioX = e.clientX;
    const inicio = larguraDe(c);
    let atual = arranjo;
    const mover = (ev: PointerEvent) => {
      atual = { ...atual, larguras: { ...atual.larguras, [c.id]: Math.max(LARGURA_MINIMA, inicio + ev.clientX - inicioX) } };
      setArranjo(atual);
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      salvar(atual);
      // O clique que encerra o arraste não deve ordenar a coluna.
      setTimeout(() => { redimensionando.current = false; }, 0);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  const soltarColuna = (alvo: IdDaColuna) => {
    if (!arrastando || arrastando === alvo) return;
    const ordem = arranjo.ordem.filter(id => id !== arrastando);
    ordem.splice(ordem.indexOf(alvo), 0, arrastando);
    salvar({ ...arranjo, ordem });
  };

  const ordenarPor = (id: IdDaColuna) => {
    if (redimensionando.current) return;
    setOrdenacao(o => (o?.id === id ? (o.asc ? { id, asc: false } : null) : { id, asc: true }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Altura das linhas" className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/50">
            {ALTURAS.map(a => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={arranjo.altura === a.id}
                onClick={() => salvar({ ...arranjo, altura: a.id })}
                className={cn('h-7 px-2.5 rounded-md text-xs font-semibold',
                  arranjo.altura === a.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { salvar(ARRANJO_PADRAO); setOrdenacao(null); }}>
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card max-h-[70vh]">
        <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: colunas.reduce((s, c) => s + larguraDe(c), 0) }}>
          <colgroup>{colunas.map(c => <col key={c.id} style={{ width: larguraDe(c) }} />)}</colgroup>
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr>
              {colunas.map(c => (
                <th
                  key={c.id}
                  draggable
                  onDragStart={() => setArrastando(c.id)}
                  onDragEnd={() => setArrastando(null)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => soltarColuna(c.id)}
                  onClick={() => ordenarPor(c.id)}
                  aria-sort={ordenacao?.id === c.id ? (ordenacao.asc ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'relative h-9 px-3 text-left text-xs font-semibold text-muted-foreground border-b border-r border-border/60 select-none cursor-grab',
                    arrastando === c.id && 'opacity-50'
                  )}
                >
                  <span className="flex items-center gap-1 truncate">
                    {c.titulo}
                    {ordenacao?.id === c.id && (ordenacao.asc ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />)}
                  </span>
                  <span
                    role="separator"
                    aria-label={`Ajustar largura de ${c.titulo}`}
                    onPointerDown={e => iniciarRedimensionamento(e, c)}
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chamados.map(t => (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => navigate(`/ticket/${t.id}`)}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/ticket/${t.id}`); }}
                className={cn(classeDaAltura, 'cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40')}
              >
                {colunas.map(c => (
                  <td key={c.id} className="px-3 border-b border-r border-border/40 overflow-hidden">
                    <div className={cn('min-w-0', arranjo.altura === 'alta' ? 'line-clamp-2' : 'truncate')}>{c.celula(t)}</div>
                  </td>
                ))}
              </tr>
            ))}
            {chamados.length === 0 && (
              <tr><td colSpan={colunas.length} className="py-12 text-center text-muted-foreground">Nenhum chamado com os filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
