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
import { cn } from '@/lib/utils';

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
    company_name?: string | null;
  };
  totalTimeMinutes?: number;
  canManageTickets: boolean;
  onResolve: () => void;
  onEscalate: () => void;
  onAttach: () => void;
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
  const { data: activeTimer } = useActiveTimer(user?.id);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const isAssignedToMe = Boolean(user && ticket.assigned_to_user_id === user.id);
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const canAssume = canManageTickets && !isResolved && !isAssignedToMe;

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

  const formatTotalTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      {/* Linha 1: Número + Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-lg font-bold text-muted-foreground">#{ticket.ticket_number}</span>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{ticket.title}</h1>
          </div>
        </div>
        
        {/* Responsável no Header com botão Assumir quando não atribuído ou de outro técnico */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-lg border border-border/50">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Responsável:</span>
          <span className="text-sm font-bold text-foreground">{ticket.assigned_to || 'Não atribuído'}</span>
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
      </div>

      {/* Linha 2: Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} />
        
        {/* Badge de Horas Apontadas */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-primary cursor-help">
              <Timer className="w-3 h-3" />
              <span className="text-sm font-bold">{formatTotalTime(totalTimeMinutes)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Total de tempo apontado neste chamado</TooltipContent>
        </Tooltip>

        {ticket.company_name && (
          <span className="text-sm text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
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
              disabled={isAssuming}
              className="gap-2 shadow-sm font-bold"
            >
              <HandHelping className="w-3.5 h-3.5" />
              {isAssuming ? 'Assumindo Chamado...' : 'Assumir Chamado'}
            </Button>
          )}

          {!isResolved && (
            <>
              <Button
                variant={isTimerActiveHere ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleTimerToggle}
                disabled={!!isTimerActiveElsewhere || startTimer.isPending || stopTimer.isPending}
                className="gap-2"
              >
                {isTimerActiveHere ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Parar {elapsed}
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Iniciar Timer
                  </>
                )}
              </Button>

              {/* Ação rápida para Atender (in-progress) se estiver em outro status */}
              {ticket.status !== 'in-progress' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('in-progress')}
                  className="gap-2 border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
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
                className={cn("gap-2", ticket.status === 'awaiting-customer' && "bg-purple-500/10 text-purple-600 border-purple-200")}
                disabled={ticket.status === 'awaiting-customer'}
              >
                <Clock className="w-3.5 h-3.5" />
                {ticket.status === 'awaiting-customer' ? 'Aguardando Cliente' : 'Aguardar Cliente'}
              </Button>

              {/* Botão Resolver */}
              <Button variant="default" size="sm" onClick={onResolve} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolver
              </Button>

              <Button variant="outline" size="sm" onClick={onEscalate} className="gap-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Escalar
              </Button>

              <Button variant="outline" size="sm" onClick={onAttach} className="gap-2">
                <Paperclip className="w-3.5 h-3.5" />
                Anexar
              </Button>
            </>
          )}

          {/* Botão Concluir Chamado para tickets resolvidos */}
          {ticket.status === 'resolved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange('closed')}
              className="gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold"
            >
              <Check className="w-3.5 h-3.5" />
              Concluir Chamado
            </Button>
          )}

          {onSummarize && !isResolved && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSummarize} 
              disabled={isSummarizing} 
              className={cn("gap-2 border-purple-200 text-purple-600", !isSummarizing && "bg-purple-500/10 hover:bg-purple-500/20")}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSummarizing ? 'Resumindo...' : 'Resumir com IA'}
            </Button>
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
