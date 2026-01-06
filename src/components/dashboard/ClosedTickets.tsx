import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const ClosedTickets: React.FC = () => {
  const navigate = useNavigate();
  const { data: closedTickets = [], isLoading: loadingClosed } = useTickets('closed');
  const { data: resolvedTickets = [], isLoading: loadingResolved } = useTickets('resolved');
  
  // Combinar chamados fechados e resolvidos, ordenar por mais recentes
  const tickets = [...closedTickets, ...resolvedTickets].sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const isLoading = loadingClosed || loadingResolved;

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <span>Últimos Chamados Fechados</span>
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
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <span>Últimos Chamados Fechados</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tickets.slice(0, 5).map((ticket) => (
            <div 
              key={ticket.id} 
              onClick={() => navigate(`/ticket/${ticket.id}`)}
              className="grid grid-cols-[5rem_1fr_9rem_7rem] items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              {/* Coluna 1 - ID */}
              <Badge variant="outline" className="font-mono font-semibold w-fit">
                #{ticket.ticket_number}
              </Badge>
              
              {/* Coluna 2 - Título/Categoria */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                <p className="text-xs text-muted-foreground truncate">{ticket.category}</p>
              </div>
              
              {/* Coluna 3 - Resolvido por */}
              <div className="text-right min-w-0">
                <p className="text-xs text-muted-foreground">Resolvido por</p>
                <p className="text-sm font-semibold text-foreground truncate">{ticket.assigned_to || 'Sistema'}</p>
              </div>
              
              {/* Coluna 4 - Badge/Data */}
              <div className="text-right">
                <Badge variant={ticket.status === 'closed' ? 'secondary' : 'default'} className="text-xs">
                  {ticket.status === 'closed' ? 'Fechado' : 'Resolvido'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(ticket.updated_at)}</p>
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum chamado fechado recentemente.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
