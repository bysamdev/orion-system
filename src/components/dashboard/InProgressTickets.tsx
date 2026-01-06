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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="grid grid-cols-[5rem_1fr_11rem_6rem] items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              {/* Coluna 1 - ID */}
              <Badge variant="outline" className="font-mono font-semibold w-fit">
                #{ticket.ticket_number}
              </Badge>
              
              {/* Coluna 2 - Solicitante/Categoria */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ticket.requester_name}</p>
                <p className="text-xs text-muted-foreground truncate">{ticket.category}</p>
              </div>
              
              {/* Coluna 3 - Técnico */}
              <div className="text-right min-w-0">
                <p className="text-xs text-muted-foreground">Atendendo</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {ticket.assigned_to || 'Não atribuído'}
                </p>
              </div>
              
              {/* Coluna 4 - Data */}
              <p className="text-xs text-muted-foreground text-right">
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