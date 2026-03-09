import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Clock } from 'lucide-react';
import { useTickets } from '@/hooks/useTickets';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { SLABadge } from './SLABadge';

interface CustomerTicketsTableProps {
  filter?: 'open' | 'closed';
  title?: string;
  emptyMessage?: string;
}

export const CustomerTicketsTable: React.FC<CustomerTicketsTableProps> = ({ 
  filter = 'open',
  title = 'Meus Chamados',
  emptyMessage = 'Você não possui chamados no momento.'
}) => {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useTickets(filter);
  
  useRealtimeTickets();

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <p className="text-muted-foreground">Carregando chamados...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {title}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({tickets.length})
          </span>
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="font-semibold text-foreground">Ticket</TableHead>
              <TableHead className="font-semibold text-foreground">Título</TableHead>
              <TableHead className="font-semibold text-foreground">Prioridade</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">SLA</TableHead>
              <TableHead className="font-semibold text-foreground">Operador</TableHead>
              <TableHead className="font-semibold text-foreground text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow 
                  key={ticket.id} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                >
                  <TableCell className="font-mono font-semibold text-primary whitespace-nowrap">
                    #{ticket.ticket_number}
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <SLABadge 
                      slaStatus={ticket.sla_status} 
                      slaDueDate={ticket.sla_due_date}
                      variant="compact"
                    />
                  </TableCell>
                  <TableCell className="max-w-[150px]">
                    {ticket.operator_name ? (
                      <span className="font-medium text-foreground truncate block">{ticket.operator_name}</span>
                    ) : (
                      <span className="text-muted-foreground/70 italic text-sm whitespace-nowrap">
                        Aguardando Atendimento
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:border-primary"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver Detalhes do Chamado</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
