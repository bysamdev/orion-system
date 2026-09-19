import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, HandHelping } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getPriorityLabel } from '@/lib/state-tokens';
import type { Ticket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import {
  COR_DO_PRAZO, FAIXA_DA_PRIORIDADE, categoriaDe, corDoAvatar, iniciais, prazoDe, semResponsavel,
} from './identidade';

const Avatar: React.FC<{ nome: string | null | undefined; tamanho?: 'sm' | 'md' }> = ({ nome, tamanho = 'sm' }) => (
  <span
    title={nome ?? undefined}
    className={cn(
      'inline-flex items-center justify-center rounded-full font-semibold shrink-0',
      tamanho === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs',
      corDoAvatar(nome)
    )}
  >
    {iniciais(nome)}
  </span>
);

const Prazo: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const prazo = prazoDe(ticket);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap', COR_DO_PRAZO[prazo.tom])}>
      <AlarmClock className="w-3.5 h-3.5 shrink-0" />
      {prazo.texto}
    </span>
  );
};

const Responsavel: React.FC<{ ticket: Ticket; onAssume: (id: string) => void }> = ({ ticket, onAssume }) =>
  semResponsavel(ticket) ? (
    <Button
      size="sm"
      onClick={e => { e.stopPropagation(); onAssume(ticket.id); }}
      className="h-7 px-3 rounded-lg text-xs font-semibold gap-1"
    >
      <HandHelping className="w-3.5 h-3.5" /> Assumir
    </Button>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
      <Avatar nome={ticket.assigned_to} />
      <span className="truncate max-w-[110px]">{ticket.assigned_to}</span>
    </span>
  );

interface CartaoDeChamadoProps {
  ticket: Ticket;
  onAssume: (id: string) => void;
  // 'linha' ocupa a largura toda (Lista); 'cartao' é o bloco do Quadro.
  variante?: 'linha' | 'cartao';
}

export const CartaoDeChamado: React.FC<CartaoDeChamadoProps> = React.memo(({ ticket: t, onAssume, variante = 'linha' }) => {
  const navigate = useNavigate();
  const categoria = categoriaDe(t.category);
  const Icone = categoria.icone;
  const abrir = () => navigate(`/ticket/${t.id}`);
  const aberto = formatDistanceToNowStrict(new Date(t.created_at), { locale: ptBR, addSuffix: true });

  const cabecalho = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
      <span className="font-mono">#{t.ticket_number}</span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1 truncate">
        <Icone className="w-3.5 h-3.5 shrink-0" />
        {categoria.rotulo}
      </span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{getPriorityLabel(t.priority)}</span>
    </div>
  );

  const solicitante = (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
      <Avatar nome={t.requester_name} />
      <span className="truncate">
        <span className="text-foreground/80">{t.requester_name}</span>
        {t.company_name ? ` · ${t.company_name}` : ''}
        {variante === 'linha' ? ` · aberto ${aberto}` : ''}
      </span>
    </div>
  );

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={e => { if (e.key === 'Enter') abrir(); }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/60 bg-card cursor-pointer transition-colors',
        'hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        variante === 'linha' ? 'pl-4 pr-3 py-3' : 'pl-4 pr-3 py-3 space-y-2.5'
      )}
    >
      <span
        aria-label={`Prioridade ${getPriorityLabel(t.priority)}`}
        className={cn('absolute left-0 top-0 bottom-0 w-1', FAIXA_DA_PRIORIDADE[t.priority] ?? 'bg-slate-400')}
      />

      {variante === 'linha' ? (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <span className="hidden md:inline-flex w-9 h-9 rounded-lg bg-muted items-center justify-center shrink-0">
            <Icone className="w-4 h-4 text-muted-foreground" />
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            {cabecalho}
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
            {solicitante}
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-2 md:justify-end shrink-0">
            <Prazo ticket={t} />
            <StatusBadge status={t.status} />
            <div className="md:w-[150px] flex md:justify-end">
              <Responsavel ticket={t} onAssume={onAssume} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {cabecalho}
          <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{t.title}</p>
          {solicitante}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <Prazo ticket={t} />
            <Responsavel ticket={t} onAssume={onAssume} />
          </div>
        </>
      )}
    </div>
  );
});
CartaoDeChamado.displayName = 'CartaoDeChamado';
