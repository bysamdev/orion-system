import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ClosedTicket {
  id: string;
  requester: string;
  category: string;
  resolvedBy: string;
  closedAt: string;
}

const closedTickets: ClosedTicket[] = [
  { id: '#1005', requester: 'Maria Santos', category: 'Software', resolvedBy: 'Marcos Almeida', closedAt: 'há 1h' },
  { id: '#0998', requester: 'João Silva', category: 'Hardware', resolvedBy: 'Ana Costa', closedAt: 'há 3h' },
  { id: '#0987', requester: 'Pedro Lima', category: 'Rede', resolvedBy: 'Marcos Almeida', closedAt: 'há 5h' },
];

export const ClosedTickets: React.FC = () => {
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
          {closedTickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4 flex-1">
                <Badge variant="outline" className="font-mono font-semibold">{ticket.id}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{ticket.requester}</p>
                  <p className="text-xs text-muted-foreground">{ticket.category}</p>
                </div>
              </div>
              <div className="text-center mx-4">
                <p className="text-xs text-muted-foreground">Resolvido por</p>
                <p className="text-sm font-semibold text-foreground">{ticket.resolvedBy}</p>
              </div>
              <p className="text-xs text-muted-foreground min-w-[60px] text-right">{ticket.closedAt}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
