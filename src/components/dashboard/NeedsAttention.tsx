import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { SLABadge } from './SLABadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';

export const NeedsAttention: React.FC = () => {
  const navigate = useNavigate();
  const { data: openTickets = [], isLoading } = useTickets('open');
  
  // Priorizar tickets com SLA em risco/estourado, depois os mais antigos
  const attentionTickets = [...openTickets]
    .sort((a, b) => {
      // SLA breached primeiro, depois attention, depois ok
      const slaOrder = { breached: 0, attention: 1, ok: 2 };
      const aOrder = slaOrder[a.sla_status as keyof typeof slaOrder] ?? 2;
      const bOrder = slaOrder[b.sla_status as keyof typeof slaOrder] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 5);

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Atenção Necessária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (attentionTickets.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Atenção Necessária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">Nenhum chamado pendente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Atenção Necessária
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {attentionTickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => navigate(`/ticket/${ticket.id}`)}
            className={cn(
              "flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors",
              ticket.sla_status === 'breached' && "border-l-4 border-l-destructive",
              ticket.sla_status === 'attention' && "border-l-4 border-l-warning"
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                #{ticket.ticket_number}
              </Badge>
              <span className="text-xs text-foreground truncate">{ticket.title}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <PriorityBadge priority={ticket.priority} size="sm" />
              <SLABadge 
                slaStatus={ticket.sla_status} 
                slaDueDate={ticket.sla_due_date}
                variant="compact"
              />
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(ticket.created_at)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
