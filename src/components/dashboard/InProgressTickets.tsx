import React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';

export const InProgressTickets: React.FC = () => {
  const { data: tickets = [], isLoading } = useTickets('in-progress');
  const navigate = useNavigate();
  
  // Enable realtime updates
  useRealtimeTickets();

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            Chamados em Atendimento
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
          <Clock className="w-4 h-4 text-warning" />
          Chamados em Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-3 sm:gap-0 cursor-pointer"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <Badge variant="outline" className="font-mono font-semibold flex-shrink-0">#{ticket.ticket_number}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ticket.requester_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ticket.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="text-left sm:text-center flex-1 sm:flex-initial">
                  <p className="text-xs text-muted-foreground">Atendendo</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {ticket.assigned_to || 'Não atribuído'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground min-w-[60px] text-right flex-shrink-0">{formatTimeAgo(ticket.updated_at)}</p>
              </div>
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