import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ClosedTickets: React.FC = () => {
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
            <CheckCircle2 className="w-4 h-4 text-success" />
            Últimos Chamados Fechados
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
          <CheckCircle2 className="w-4 h-4 text-success" />
          Últimos Chamados Fechados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tickets.slice(0, 5).map((ticket) => (
            <div key={ticket.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-3 sm:gap-0">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <Badge variant="outline" className="font-mono font-semibold flex-shrink-0">#{ticket.ticket_number}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{ticket.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="text-left sm:text-center flex-1 sm:flex-initial">
                  <p className="text-xs text-muted-foreground">Resolvido por</p>
                  <p className="text-sm font-semibold text-foreground truncate">{ticket.assigned_to || 'Sistema'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant={ticket.status === 'closed' ? 'secondary' : 'default'} className="text-xs">
                    {ticket.status === 'closed' ? 'Fechado' : 'Resolvido'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(ticket.updated_at)}</p>
                </div>
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
