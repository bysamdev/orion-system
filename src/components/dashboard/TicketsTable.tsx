import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTickets, useUpdateTicketStatus } from '@/hooks/useTickets';
import { useUserRole } from '@/hooks/useUserRole';
import { useTicketFilters } from '@/hooks/useTicketFilters';
import { TicketFilters } from './TicketFilters';
import { SLABadge } from './SLABadge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';

const priorityColors = {
  urgent: 'bg-red-500',
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted'
};

const statusLabels: Record<string, string> = {
  'open': 'Aberto',
  'in-progress': 'Em Andamento',
  'resolved': 'Resolvido',
  'closed': 'Fechado',
  'reopened': 'Reaberto'
};

export const TicketsTable: React.FC = () => {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useTickets('open');
  const { data: userRole } = useUserRole();
  const updateStatus = useUpdateTicketStatus();
  
  // Enable realtime updates
  useRealtimeTickets();
  
  // Advanced filters
  const { filters, filteredTickets, updateFilters, resetFilters, activeFiltersCount } = useTicketFilters(tickets);

  // Check if user can manage tickets (technician or admin)
  const canManageTickets = userRole === 'technician' || userRole === 'admin';

  const handleStartTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Get current user info to assign ticket
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    // Update both status and assignment
    await updateStatus.mutateAsync({ 
      id: ticketId, 
      status: 'in-progress',
      assigned_to: profile?.full_name || '',
      assigned_to_user_id: user.id
    });
  };

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
  };

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
        <h3 className="text-base font-semibold text-foreground">
          Últimos chamados abertos
          {activeFiltersCount > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filteredTickets.length} de {tickets.length})
            </span>
          )}
        </h3>
      </div>
      
      <TicketFilters 
        filters={filters}
        onFiltersChange={updateFilters}
        onReset={resetFilters}
      />
      
      <div className="mt-6">
        <Table>
          <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="font-semibold text-foreground">Ticket</TableHead>
            <TableHead className="font-semibold text-foreground">Solicitante</TableHead>
            <TableHead className="font-semibold text-foreground">Empresa</TableHead>
            <TableHead className="font-semibold text-foreground">Prioridade</TableHead>
            <TableHead className="font-semibold text-foreground">SLA</TableHead>
            <TableHead className="font-semibold text-foreground">Operador</TableHead>
            <TableHead className="font-semibold text-foreground text-center">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum chamado encontrado
              </TableCell>
            </TableRow>
          ) : (
            filteredTickets.map((ticket) => (
            <TableRow 
              key={ticket.id} 
              className="hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <TableCell className="font-mono font-medium text-foreground">#{ticket.ticket_number}</TableCell>
              <TableCell className="max-w-[150px]">
                <div className="truncate">
                  <div className="font-medium text-foreground truncate">{ticket.requester_name}</div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[120px] truncate">{ticket.company_name || 'N/A'}</TableCell>
              <TableCell>
                <div className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", priorityColors[ticket.priority])}>
                  {ticket.priority === 'urgent' ? 'Urgente' : ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa'}
                </div>
              </TableCell>
              <TableCell>
                <SLABadge 
                  slaStatus={ticket.sla_status} 
                  slaDueDate={ticket.sla_due_date}
                  variant="compact"
                />
              </TableCell>
              <TableCell className="max-w-[120px]">
                {ticket.operator_name && (
                  <div className="truncate text-foreground font-medium">{ticket.operator_name}</div>
                )}
              </TableCell>
              <TableCell className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {canManageTickets ? (
                        <Button
                          variant={ticket.status === 'in-progress' ? 'secondary' : 'default'}
                          size="icon"
                          onClick={(e) => handleStartTicket(ticket.id, e)}
                          disabled={ticket.status === 'in-progress' || updateStatus.isPending}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {statusLabels[ticket.status] || ticket.status}
                        </span>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{ticket.status === 'in-progress' ? 'Em Andamento' : 'Iniciar Atendimento'}</p>
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
