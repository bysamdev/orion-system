import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  requester: string;
  category: string;
  created: string;
  priority: 'high' | 'medium' | 'low';
  operator: string;
  status: 'open' | 'in-progress' | 'closed';
}

const mockTickets: Ticket[] = [
  {
    id: '#1010',
    requester: 'Cleber Junior',
    category: 'ERP',
    created: 'há 3h',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1292',
    requester: 'Roberto Mariano',
    category: 'E-mail',
    created: 'há 2h',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1156',
    requester: 'Ana Silva',
    category: 'Hardware',
    created: 'há 5h',
    priority: 'medium',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1089',
    requester: 'Carlos Santos',
    category: 'Rede',
    created: 'há 6h',
    priority: 'low',
    operator: 'Marcos Almeida',
    status: 'open'
  }
];

const priorityColors = {
  high: 'bg-destructive hover:bg-destructive',
  medium: 'bg-warning hover:bg-warning',
  low: 'bg-muted hover:bg-muted'
};

export const TicketsTable: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);

  const handleStartTicket = (ticketId: string) => {
    setTickets(prev => 
      prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: 'in-progress' as const }
          : ticket
      )
    );
  };

  return (
    <div className="bg-card rounded-3xl p-6 shadow-sm border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="font-bold text-foreground">Ticket</TableHead>
            <TableHead className="font-bold text-foreground">Solicitante</TableHead>
            <TableHead className="font-bold text-foreground">Categoria</TableHead>
            <TableHead className="font-bold text-foreground">Criado</TableHead>
            <TableHead className="font-bold text-foreground">Prioridade</TableHead>
            <TableHead className="font-bold text-foreground">Operador</TableHead>
            <TableHead className="font-bold text-foreground text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id} className="hover:bg-muted/50 transition-colors">
              <TableCell className="font-medium text-muted-foreground">{ticket.id}</TableCell>
              <TableCell className="text-foreground">{ticket.requester}</TableCell>
              <TableCell className="text-muted-foreground">{ticket.category}</TableCell>
              <TableCell className="text-muted-foreground">{ticket.created}</TableCell>
              <TableCell>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "w-8 h-8 rounded-full p-0 flex items-center justify-center border-0",
                    priorityColors[ticket.priority]
                  )}
                >
                  <AlertCircle className="w-4 h-4 text-white" />
                </Badge>
              </TableCell>
              <TableCell className="font-semibold text-foreground">{ticket.operator}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={ticket.status === 'in-progress' ? 'secondary' : 'default'}
                  size="sm"
                  onClick={() => handleStartTicket(ticket.id)}
                  className={cn(
                    "font-semibold gap-2",
                    ticket.status === 'in-progress' && "bg-success hover:bg-success"
                  )}
                >
                  <PlayCircle className="w-4 h-4" />
                  {ticket.status === 'in-progress' ? 'Em andamento' : 'Iniciar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
