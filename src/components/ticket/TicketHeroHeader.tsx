import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SLABadge } from '@/components/dashboard/SLABadge';
import { Timer, CheckCircle2, ArrowUpRight, Paperclip, BookOpen, Play, Square, User, Clock, Merge, Sparkles, HandHelping, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProfilesMap, resolveUserDisplayName } from '@/hooks/useUserDisplayName';
import { cn, formatDurationHuman, formatDate } from '@/lib/utils';

interface TicketHeroHeaderProps {
  ticket: {
    id: string;
    ticket_number: number;
    title: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    assigned_to_user_id?: string | null;
    sla_status: string | null;
    sla_due_date: string | null;
    created_at?: string;
    resolved_at?: string | null;
    company_name?: string | null;
  };
  totalTimeMinutes?: number;
  canManageTickets: boolean;
  isSporadic?: boolean;
  onResolve: () => void;
  onEscalate: () => void;
  onAttach?: () => void;
  onStatusChange: (status: string) => void;
  onAssume?: () => void;
  isAssuming?: boolean;
  onLinkKB?: () => void;
  onMerge?: () => void;
  onSummarize?: () => void;
  isSummarizing?: boolean;
}

export const TicketHeroHeader: React.FC<TicketHeroHeaderProps> = ({
  ticket,
  totalTimeMinutes = 0,
  canManageTickets,
  isSporadic = false,
  onResolve,
  onEscalate,
  onAttach,
  onStatusChange,
  onAssume,
  isAssuming = false,
  onLinkKB,
  onMerge,
  onSummarize,
  isSummarizing,
}) => {
  const { user } = useAuth();
  const { profilesMap } = useProfilesMap();
  const { data: activeTimer } = useActiveTimer(user?.id);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const isAssignedToMe = Boolean(user && ticket.assigned_to_user_id === user.id);
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const canAssume = canManageTickets && !isResolved && !isAssignedToMe;

  const assignedToDisplayName = resolveUserDisplayName(ticket.assigned_to, profilesMap, {
    fallback: 'Não atribuído',
    unassignedFallback: 'Não atribuído',
  });

  // Timer ativo neste ticket?
  const isTimerActiveHere = activeTimer?.ticket_id === ticket.id;
  const isTimerActiveElsewhere = activeTimer && activeTimer.ticket_id !== ticket.id;

  // Elapsed time display
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!isTimerActiveHere || !activeTimer) return;
    const update = () => {
      const start = new Date(activeTimer.start_time).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isTimerActiveHere, activeTimer]);

  const handleTimerToggle = () => {
    if (!user) return;
    if (isTimerActiveHere && activeTimer) {
      stopTimer.mutate({ entryId: activeTimer.id });
    } else {
      startTimer.mutate({ ticketId: ticket.id, userId: user.id });
    }
  };

  const elapsedServiceMinutes = React.useMemo(() => {
    if (!ticket?.created_at) return 0;
    const start = new Date(ticket.created_at).getTime();
    const end = (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolved_at
      ? new Date(ticket.resolved_at).getTime()
      : Date.now();
    return Math.max(1, Math.floor((end - start) / 60000));
  }, [ticket?.created_at, ticket?.resolved_at, ticket?.status]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      {/* Linha 1: Número + Título */}
      {/* Linha 1: Título e Responsável + Botão Marcar como Resolvido em destaque na direita */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-lg font-bold text-muted-foreground">#{ticket.ticket_number}</span>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{ticket.title}</h1>
          </div>
        </div>
        
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Responsável no Header com botão Assumir quando não atribuído ou de outro técnico */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-lg border border-border/50">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Responsável:</span>
            <span className="text-sm font-bold text-foreground">{assignedToDisplayName}</span>
            {canAssume && onAssume && (
              <Button
                size="sm"
                variant="default"
                onClick={onAssume}
                disabled={isAssuming}
                className="h-6 px-2.5 text-[10px] font-bold uppercase tracking-wider ml-1 shadow-sm gap-1"
              >
                <HandHelping className="w-3 h-3" />
                {isAssuming ? 'Assumindo...' : 'Assumir'}
              </Button>
            )}
          </div>

          {/* Botão "Marcar como resolvido" destacado na direita */}
          {canManageTickets && !isResolved && onResolve && (
            <Button
              variant="default"
              size="sm"
              onClick={onResolve}
              className="h-9 px-4 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como resolvido
            </Button>
          )}

          {/* Botão Concluir Chamado para tickets já resolvidos */}
          {canManageTickets && ticket.status === 'resolved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange('closed')}
              className="h-9 px-4 gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold shadow-sm"
            >
              <Check className="w-4 h-4" />
              Concluir Chamado
            </Button>
          )}
        </div>
      </div>

      {/* Linha 2: Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} />
        
        {/* Badge de Tempo de Atendimento */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary cursor-help text-xs font-semibold whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDurationHuman(elapsedServiceMinutes)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-bold">Tempo de Atendimento</p>
            <p className="text-xs text-muted-foreground">Iniciado em {ticket.created_at ? formatDate(ticket.created_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</p>
          </TooltipContent>
        </Tooltip>

        {ticket.company_name && (
          <span className="inline-flex items-center h-6 text-xs font-semibold text-muted-foreground bg-muted border border-border/50 px-2.5 rounded-full whitespace-nowrap">
            {ticket.company_name}
          </span>
        )}
      </div>

      {/* Linha 3: Quick Actions */}
      {canManageTickets && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          {/* Ação Assumir Chamado destacada */}
          {canAssume && onAssume && (
            <Button
              variant="default"
              size="sm"
              onClick={onAssume}
              className="gap-2 font-bold shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              Assumir Chamado
            </Button>
          )}

          {/* Ações operacionais rápidas */}
          {!isResolved && (
            <>
              {/* Botão de Timer: cronógrafo manual só pra clientes esporádicos
                  (sem contrato) -- em contrato o tempo já é rastreado por
                  outro fluxo, esse botão duplicaria a contagem. */}
              {isSporadic && (
              <Button
                variant={isTimerActiveHere ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleTimerToggle}
                disabled={!!isTimerActiveElsewhere || startTimer.isPending || stopTimer.isPending}
                className="gap-2 font-semibold"
              >
                {isTimerActiveHere ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Parar Timer
                  </>
                ) : (
                  <>
                    <Timer className="w-3.5 h-3.5" />
                    Iniciar Timer
                  </>
                )}
              </Button>
              )}

              {/* Ação rápida para Atender (in-progress) se estiver em outro status */}
              {ticket.status !== 'in-progress' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('in-progress')}
                  className="gap-2 border-cyan-500/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 font-semibold"
                >
                  <Play className="w-3.5 h-3.5" />
                  Atender
                </Button>
              )}

              {/* Botão Aguardar Cliente */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onStatusChange('awaiting-customer')} 
                className={cn("gap-2 font-semibold", ticket.status === 'awaiting-customer' && "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30")}
                disabled={ticket.status === 'awaiting-customer'}
              >
                <Clock className="w-3.5 h-3.5" />
                {ticket.status === 'awaiting-customer' ? 'Aguardando Cliente' : 'Aguardar Cliente'}
              </Button>

              <Button variant="outline" size="sm" onClick={onEscalate} className="gap-2 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Escalar
              </Button>
            </>
          )}


          {onMerge && !isResolved && (
            <Button variant="outline" size="sm" onClick={onMerge} className="gap-2">
              <Merge className="w-3.5 h-3.5" />
              Mesclar Ticket
            </Button>
          )}

          {onLinkKB && !isResolved && (
            <Button variant="outline" size="sm" onClick={onLinkKB} className="gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              Vincular KB
            </Button>
          )}

          {isTimerActiveElsewhere && activeTimer && (
            <span className="text-xs text-muted-foreground italic ml-2">
              <Link to={`/ticket/${activeTimer.ticket_id}`} className="underline hover:text-primary transition-colors">
                Timer ativo no ticket #{activeTimer.tickets?.ticket_number || 'desconhecido'} — clique para gerenciar
              </Link>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
