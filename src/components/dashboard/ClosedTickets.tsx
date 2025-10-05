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
    <Card className="border-border shadow-sm mt-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-success" />
          Últimos Chamados Fechados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {closedTickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">{ticket.id}</Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">{ticket.requester}</p>
                  <p className="text-xs text-muted-foreground">{ticket.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Resolvido por</p>
                <p className="text-sm font-medium text-foreground">{ticket.resolvedBy}</p>
              </div>
              <p className="text-xs text-muted-foreground">{ticket.closedAt}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
