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

const Avatar: React.FC<{ nome: string | null | undefined }> = ({ nome }) => (
  <span
    title={nome ?? undefined}
    aria-hidden
    className={cn(
      'inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0',
      corDoAvatar(nome)
    )}
  >
    {iniciais(nome)}
  </span>
);

const Prazo: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const prazo = prazoDe(ticket);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0', COR_DO_PRAZO[prazo.tom])}>
      <AlarmClock className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {prazo.texto}
    </span>
  );
};

// No celular o botão cresce para 36 px e ganha área de toque extra (44 px);
// no desktop fica baixo para não engordar a linha.
const Responsavel: React.FC<{ ticket: Ticket; onAssume: (id: string) => void }> = ({ ticket, onAssume }) =>
  semResponsavel(ticket) ? (
    <Button
      size="sm"
      onClick={e => { e.stopPropagation(); onAssume(ticket.id); }}
      className="relative h-9 sm:h-7 px-3 rounded-lg text-xs font-semibold gap-1 shrink-0 before:absolute before:-inset-1 before:content-['']"
    >
      <HandHelping className="w-3.5 h-3.5" aria-hidden /> Assumir
    </Button>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 shrink-0 max-w-[45%]">
      <Avatar nome={ticket.assigned_to} />
      <span className="truncate">{ticket.assigned_to}</span>
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
  const prioridade = getPriorityLabel(t.priority);

  // Número, categoria e prioridade: o que identifica o chamado sem ler o título.
  // No Quadro a coluna é estreita: a categoria vira só o ícone (nome no hover
  // e para leitor de tela); a prioridade continua escrita, além da cor.
  const identificacao = (
    <>
      <span className="font-mono shrink-0">#{t.ticket_number}</span>
      <span aria-hidden className="shrink-0">·</span>
      <span className="inline-flex items-center gap-1 min-w-0" title={categoria.rotulo}>
        <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className={variante === 'cartao' ? 'sr-only' : 'truncate'}>{categoria.rotulo}</span>
      </span>
      <span aria-hidden className="shrink-0">·</span>
      <span className="whitespace-nowrap shrink-0">{prioridade}</span>
    </>
  );

  const solicitante = (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Avatar nome={t.requester_name} />
      <span className="truncate">
        <span className="text-foreground/80">{t.requester_name}</span>
        {t.company_name ? ` · ${t.company_name}` : ''}
      </span>
    </span>
  );

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={e => { if (e.key === 'Enter') abrir(); }}
      aria-label={`Chamado ${t.ticket_number}: ${t.title}`}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border/60 bg-card cursor-pointer transition-colors',
        'hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'pl-3.5 pr-3 py-2'
      )}
    >
      <span
        title={`Prioridade ${prioridade}`}
        className={cn('absolute left-0 top-0 bottom-0 w-1', FAIXA_DA_PRIORIDADE[t.priority] ?? 'bg-slate-400')}
      />

      {variante === 'linha' ? (
        <div className="flex flex-col md:flex-row md:items-center gap-x-4 gap-y-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 mt-0.5">
              {identificacao}
              <span aria-hidden className="shrink-0">·</span>
              {solicitante}
              <span className="hidden lg:inline whitespace-nowrap shrink-0">· aberto {aberto}</span>
            </div>
          </div>
          <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap md:flex-nowrap shrink-0">
            <span className="md:w-[140px] md:text-right"><Prazo ticket={t} /></span>
            <span className="md:w-[130px] flex md:justify-center"><StatusBadge status={t.status} /></span>
            <div className="md:w-[130px] flex md:justify-end min-w-0">
              <Responsavel ticket={t} onAssume={onAssume} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground min-h-7">
            <span className="flex items-center gap-1.5 min-w-0">{identificacao}</span>
            <Responsavel ticket={t} onAssume={onAssume} />
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{t.title}</p>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {solicitante}
            <Prazo ticket={t} />
          </div>
        </div>
      )}
    </div>
  );
});
CartaoDeChamado.displayName = 'CartaoDeChamado';
