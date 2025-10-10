import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    created: 'há 21m',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1009',
    requester: 'Roberto Mariano',
    category: 'E-mail',
    created: 'há 6h',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1008',
    requester: 'Ana Silva',
    category: 'Hardware',
    created: 'há 23h',
    priority: 'medium',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1007',
    requester: 'Carlos Santos',
    category: 'Rede',
    created: 'há 12d',
    priority: 'low',
    operator: 'Marcos Almeida',
    status: 'open'
  }
];

const priorityColors = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted'
};

export const TicketsTable: React.FC = () => {
  const navigate = useNavigate();
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
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="font-semibold text-foreground">Ticket</TableHead>
            <TableHead className="font-semibold text-foreground">Solicitante</TableHead>
            <TableHead className="font-semibold text-foreground">Categoria</TableHead>
            <TableHead className="font-semibold text-foreground">Criado</TableHead>
            <TableHead className="font-semibold text-foreground">Prioridade</TableHead>
            <TableHead className="font-semibold text-foreground">Operador</TableHead>
            <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow 
              key={ticket.id} 
              className="hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <TableCell className="font-mono font-medium text-foreground">{ticket.id}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium text-foreground">{ticket.requester.split(' ')[0]}</div>
                  <div className="text-sm text-muted-foreground">{ticket.requester.split(' ').slice(1).join(' ')}</div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{ticket.category}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{ticket.created}</TableCell>
              <TableCell>
                <div className={cn("w-6 h-6 rounded-full", priorityColors[ticket.priority])}></div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{ticket.operator.split(' ')[0]}</div>
                <div className="text-sm text-muted-foreground">{ticket.operator.split(' ').slice(1).join(' ')}</div>
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant={ticket.status === 'in-progress' ? 'secondary' : 'default'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartTicket(ticket.id);
                  }}
                  disabled={ticket.status === 'in-progress'}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  {ticket.status === 'in-progress' ? 'Em Andamento' : 'Iniciar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
