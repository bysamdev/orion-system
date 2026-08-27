import { useNavigate } from 'react-router-dom';
import { Ticket, Loader2, Inbox } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { useMachineTickets } from '@/hooks/useMonitoring';
import { formatDate } from '@/lib/utils';

// Histórico de chamados abertos por esta máquina — não é "meus chamados":
// como "Abrir Chamado" sempre autentica pelo mesmo usuário-fantasma da
// máquina (ver lib.MachineGhostEmail no backend), esta lista junta os
// chamados de QUALQUER pessoa que já usou essa máquina, não só de um
// usuário específico. Rótulo da aba ("Chamados desta máquina") existe
// pra deixar essa diferença clara — ver observação do usuário sobre o
// campo de exibição do requisitante já cobrir "quem", esta aba cobre "de
// qual máquina".
export function MachineTicketsTab({ machineId }: { machineId: string | null }) {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useMachineTickets(machineId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-xs font-medium">Carregando histórico de chamados...</span>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-center px-6">
        <Inbox className="w-8 h-8 opacity-40" />
        <p className="text-sm font-medium">Nenhum chamado aberto por esta máquina ainda.</p>
        <p className="text-xs opacity-70">
          Aparece aqui assim que alguém clicar em "Abrir Chamado" pela bandeja do agente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Chamados desta máquina — de qualquer usuário que a utilizou, não só do usuário atual.
      </p>
      {tickets.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(`/ticket/${t.id}`)}
          className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-3 hover:bg-muted/50 hover:border-border transition-colors"
        >
          <div className="min-w-0 flex items-center gap-3">
            <Ticket className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground shrink-0">#{t.ticket_number}</span>
                <span className="text-sm font-medium truncate">{t.title}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {formatDate(t.created_at)}
                {t.category ? ` · ${t.category}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
