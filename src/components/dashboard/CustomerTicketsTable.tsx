import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTickets } from '@/hooks/useTickets';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  open: { label: 'Aberto', variant: 'warning' as const, className: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  'in-progress': { label: 'Em Andamento', variant: 'default' as const, className: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  resolved: { label: 'Resolvido', variant: 'success' as const, className: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' },
  closed: { label: 'Fechado', variant: 'secondary' as const, className: 'bg-muted text-muted-foreground border-border' },
  reopened: { label: 'Reaberto', variant: 'destructive' as const, className: 'bg-orange-500/20 text-orange-600 border-orange-500/30' },
};

const priorityLabels = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa'
};

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
              <TableHead className="font-semibold text-foreground">Operador</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => {
                const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.open;
                
                return (
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
                        <p className="truncate font-medium text-foreground">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-xs font-medium",
                        ticket.priority === 'urgent' && "bg-red-500/20 text-red-600 border-red-500/30",
                        ticket.priority === 'high' && "bg-orange-500/20 text-orange-600 border-orange-500/30",
                        ticket.priority === 'medium' && "bg-amber-500/20 text-amber-600 border-amber-500/30",
                        ticket.priority === 'low' && "bg-muted text-muted-foreground border-border"
                      )}>
                        {priorityLabels[ticket.priority as keyof typeof priorityLabels] || ticket.priority}
                      </Badge>
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
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs font-medium", status.className)}>
                        {status.label}
                      </Badge>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
