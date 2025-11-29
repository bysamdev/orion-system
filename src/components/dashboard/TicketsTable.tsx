import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTickets, useUpdateTicketStatus } from '@/hooks/useTickets';
import { useUserRole } from '@/hooks/useUserRole';
import { SLABadge } from './SLABadge';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';

const priorityColors = {
  urgent: 'bg-red-500',
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted'
};

export const TicketsTable: React.FC = () => {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useTickets('open');
  const { data: userRole } = useUserRole();
  const updateStatus = useUpdateTicketStatus();
  
  // Enable realtime updates
  useRealtimeTickets();

  // Check if user can manage tickets (technician or admin)
  const canManageTickets = userRole === 'technician' || userRole === 'admin';

  const handleAssignTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Get current user info to assign ticket
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    // Update assignment
    await updateStatus.mutateAsync({ 
      id: ticketId, 
      status: 'in-progress',
      assigned_to: profile?.full_name || '',
      assigned_to_user_id: user.id
    });
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
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({tickets.length})
          </span>
        </h3>
      </div>
      
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
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum chamado encontrado
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => (
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
                  <div className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", priorityColors[ticket.priority as keyof typeof priorityColors])}>
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
                  {ticket.operator_name ? (
                    <div className="truncate text-foreground font-medium">{ticket.operator_name}</div>
                  ) : canManageTickets ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleAssignTicket(ticket.id, e)}
                      disabled={updateStatus.isPending}
                      className="text-xs h-7 px-2 text-primary hover:text-primary/80"
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Assumir
                    </Button>
                  ) : (
                    <span className="text-muted-foreground italic text-sm">Não atribuído</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ticket/${ticket.id}`);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Visualizar Detalhes</p>
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
  );
};
