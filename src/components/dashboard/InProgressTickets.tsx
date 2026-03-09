import React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { SLABadge } from './SLABadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';

export const InProgressTickets: React.FC = () => {
  const { data: tickets = [], isLoading } = useTickets('in-progress');
  const navigate = useNavigate();
  
  useRealtimeTickets();

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning flex-shrink-0" />
            <span>Chamados em Atendimento</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning flex-shrink-0" />
          <span>Chamados em Atendimento</span>
          <span className="text-sm font-normal text-muted-foreground">({tickets.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <Badge variant="outline" className="font-mono font-semibold flex-shrink-0">
                #{ticket.ticket_number}
              </Badge>
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{ticket.requester_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{ticket.company_name || 'N/A'}</span>
                  <span>·</span>
                  <span className="truncate">{ticket.category}</span>
                </div>
              </div>

              <PriorityBadge priority={ticket.priority} size="sm" />
              
              <SLABadge 
                slaStatus={ticket.sla_status} 
                slaDueDate={ticket.sla_due_date}
                variant="compact"
              />
              
              <div className="text-right flex-shrink-0 min-w-[90px]">
                <p className="text-xs text-muted-foreground">Atendendo</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {ticket.assigned_to || 'Não atribuído'}
                </p>
              </div>
              
              <p className="text-xs text-muted-foreground flex-shrink-0">
                {formatTimeAgo(ticket.updated_at)}
              </p>
            </div>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum chamado em atendimento.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
