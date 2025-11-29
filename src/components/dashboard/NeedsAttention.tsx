import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const NeedsAttention: React.FC = () => {
  const navigate = useNavigate();
  const { data: openTickets = [], isLoading } = useTickets('open');
  
  // Ordenar por mais antigos primeiro e pegar os 3 primeiros
  const oldestTickets = [...openTickets]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 3);

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

  if (oldestTickets.length === 0) {
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
        {oldestTickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => navigate(`/ticket/${ticket.id}`)}
            className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                #{ticket.ticket_number}
              </Badge>
              <span className="text-xs text-foreground truncate">{ticket.title}</span>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {formatTimeAgo(ticket.created_at)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
