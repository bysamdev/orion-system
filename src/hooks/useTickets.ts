import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { ticketStatusSchema, ticketPrioritySchema, ticketUpdateSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';
import { MOCK_TICKETS, getMockTicketsByStatus } from '@/mocks/tickets';
import { construirFiltroPeriodoRelatorio } from '@/lib/reports/aggregations';

export interface Ticket {
  id: string;
  ticket_number: number;
  title: string;
  description: string;
  requester_name: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'awaiting-customer' | 'awaiting-third-party' | 'resolved' | 'closed' | 'reopened' | 'cancelled';
  operator_name: string | null;
  assigned_to: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
  company_name: string | null;
  assigned_to_user_id?: string | null;
  // Campos SLA
  sla_due_date: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_status: 'ok' | 'warning' | 'attention' | 'breached' | null;
  // Campos de Acesso Remoto
  remote_id: string | null;
  remote_password: string | null;
  sla_paused_at: string | null;
  sla_accumulated_pause_minutes: number | null;
  contract_id: string | null;
  asset_id: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  author: string;
  content: string;
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change';
  created_at: string;
  is_internal: boolean;
}

interface DateRangeArgs {
  dateFrom: string;
  dateTo: string;
}

// Teto de segurança, não paginação de UI: esta query não tem controles de
// página (diferente de useMeusTickets em useMyTickets.ts, que já pagina de
// verdade via .range()). Sem isso, uma chamada sem status nem dateRange
// buscaria a tabela tickets inteira. order('created_at', desc) garante que
// o corte mantém os mais recentes.
const TICKET_LIST_SAFETY_LIMIT = 1000;

export const useTickets = (status?: string, dateRange?: DateRangeArgs) => {
  return useQuery({
    queryKey: ['tickets', status, dateRange],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(status) as unknown as Promise<Ticket[]>;
      }

      // Use read client for queries
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        // Se status for 'open', incluir também 'reopened' e aguardando
        if (status === 'open') {
          query = query.in('status', ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party']);
        } else if (status === 'closed') {
          query = query.in('status', ['closed', 'cancelled']);
        } else {
          query = query.eq('status', status);
        }
      }

      if (dateRange) {
        // Sem isso, Reports.tsx buscava a tabela de tickets inteira da
        // empresa a cada carregamento e só filtrava depois no cliente — não
        // escala conforme o histórico cresce.
        query = query.or(construirFiltroPeriodoRelatorio(dateRange));
      }

      query = query.limit(TICKET_LIST_SAFETY_LIMIT);

      const { data: tickets, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
      
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
    },
    staleTime: 30_000,
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        const mockTicket = MOCK_TICKETS.find(t => t.id === id) || MOCK_TICKETS[0];
        return mockTicket as Ticket;
      }

      console.log('[useTicket] Buscando ticket com id:', id);
      // Busca o ticket com o nome do operador via FK explícita (evita PGRST201)
      // Não usamos join aninhado profiles→companies pois há múltiplas FKs e gera ambiguidade.
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
          *,
          profiles:fk_tickets_user (
            full_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('[useTicket] Erro retornado pelo Supabase:', error.code, error.message, error.details);
        throw error;
      }

      // Busca o nome da empresa separadamente usando o company_id do próprio ticket
      let companyName: string | null = null;
      if (ticket.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', ticket.company_id)
          .maybeSingle();
        companyName = company?.name ?? null;
      }

      // Limpa o objeto aninhado para não poluir o estado
      const { profiles, ...cleanedTicket } = ticket as typeof ticket & { profiles?: unknown };

      const dynamicSlaStatus = ticket.sla_due_date ? calculateSlaStatus(ticket.sla_due_date, ticket.created_at) : ticket.sla_status;
      return { ...cleanedTicket, company_name: companyName, sla_status: dynamicSlaStatus } as Ticket;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
};

export const useTicketUpdates = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-updates', ticketId],
    queryFn: async () => {
      // Fetch updates and associated author profiles in a single query using joins
      const { data: updates, error } = await supabase
        .from('ticket_updates')
        .select(`
          *,
          profiles:author_id (
            full_name
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!updates || updates.length === 0) return [];

      return updates.map(u => {
        // Extract nested profile full_name if available
        let authorName = u.author || 'Sistema';
        if (u.profiles && !Array.isArray(u.profiles)) {
          authorName = (u.profiles as { full_name?: string }).full_name || authorName;
        }

        // Clean up nested objects
        const { profiles, ...cleanedUpdate } = u as typeof u & { profiles?: unknown };

        return {
          ...cleanedUpdate,
          author: authorName
        } as TicketUpdate;
      });
    },
    enabled: !!ticketId,
    staleTime: 60_000,
  });
};

export const invalidateTicketQueries = (queryClient: any, ticketId?: string) => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
  queryClient.invalidateQueries({ queryKey: ['my-active-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
  queryClient.invalidateQueries({ queryKey: ['all-active-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['technician-stats'] });
  queryClient.invalidateQueries({ queryKey: ['my-recent-closed'] });
  queryClient.invalidateQueries({ queryKey: ['sla-at-risk-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['technician-workload'] });
  queryClient.invalidateQueries({ queryKey: ['team-workload'] });
  queryClient.invalidateQueries({ queryKey: ['meus-tickets'] });
  if (ticketId) {
    queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['ticket-updates', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['ticket-status-history', ticketId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['ticket'] });
    queryClient.invalidateQueries({ queryKey: ['ticket-updates'] });
    queryClient.invalidateQueries({ queryKey: ['ticket-status-history'] });
  }
};

export interface UpdateTicketStatusParams {
  id: string;
  status: string;
  last_updated_at?: string | null;
  expected_status?: string | null;
  assigned_to?: string | null;
  assigned_to_user_id?: string | null;
  sla_paused_at?: string | null;
  sla_accumulated_pause_minutes?: number | null;
  resolution_notes?: string | null;
  updateContent?: string;
  updateType?: 'comment' | 'status_change' | 'assignment' | 'priority_change';
  previousStatus?: string;
  is_internal?: boolean;
}

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      last_updated_at,
      expected_status,
      assigned_to, 
      assigned_to_user_id,
      sla_paused_at,
      sla_accumulated_pause_minutes,
      resolution_notes,
      updateContent,
      updateType = 'status_change',
      previousStatus,
      is_internal = false,
    }: UpdateTicketStatusParams) => {
      // Validate status before sending to database
      const validationResult = ticketStatusSchema.safeParse(status);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      // Build update object
      const updateData: Database['public']['Tables']['tickets']['Update'] = { 
        status: validationResult.data as Database['public']['Tables']['tickets']['Update']['status'] 
      };
      
      if (assigned_to !== undefined) {
        updateData.assigned_to = assigned_to;
      }
      if (assigned_to_user_id !== undefined) {
        updateData.assigned_to_user_id = assigned_to_user_id;
      }
      if (sla_paused_at !== undefined) {
        updateData.sla_paused_at = sla_paused_at;
      }
      if (sla_accumulated_pause_minutes !== undefined) {
        updateData.sla_accumulated_pause_minutes = sla_accumulated_pause_minutes;
      }
      if (resolution_notes !== undefined) {
        updateData.resolution_notes = resolution_notes;
      }

      let query = supabase
        .from('tickets')
        .update(updateData)
        .eq('id', id);

      if (last_updated_at) {
        query = query.eq('updated_at', last_updated_at);
      }
      if (expected_status) {
        query = query.eq('status', expected_status);
      }

      const { data: ticketData, error: updateError } = await query
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw updateError;
      }

      // Safe timeline update
      if (updateContent) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error: timelineError } = await supabase
          .from('ticket_updates')
          .insert([{
            ticket_id: id,
            content: updateContent,
            type: updateType,
            author: '',
            author_id: user.id,
            is_internal
          }]);

        if (timelineError) {
          // Revert status on tickets table if timeline update fails
          if (previousStatus) {
            try {
              await supabase.from('tickets').update({ status: previousStatus }).eq('id', id);
            } catch (revertErr) {
              console.error('[useUpdateTicketStatus] Falha ao reverter status:', revertErr);
            }
          }
          throw new Error(`Falha ao registrar histórico na timeline: ${timelineError.message}. Operação cancelada e revertida.`);
        }
      }

      return ticketData;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      
      if (data.status === 'in-progress' && data.assigned_to) {
        toast({
          title: 'Atendimento iniciado',
          description: `Você foi atribuído ao chamado #${data.ticket_number}`,
        });
      } else {
        toast({
          title: 'Status atualizado',
          description: 'O status do chamado foi atualizado com sucesso.',
        });
      }
    },
    onError: (error: Error) => {
      logError('useUpdateTicketStatus', error);
      toast({
        title: 'Erro de atualização',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface UpdateAssignmentParams {
  id: string;
  assigned_to: string | null;
  assigned_to_user_id?: string | null;
  last_updated_at?: string | null;
  previousAssignedTo?: string | null;
  updateContent?: string;
}

export const useUpdateTicketAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      assigned_to,
      assigned_to_user_id,
      last_updated_at,
      previousAssignedTo,
      updateContent
    }: UpdateAssignmentParams) => {
      const updateData: Database['public']['Tables']['tickets']['Update'] = { assigned_to };
      if (assigned_to_user_id !== undefined) {
        updateData.assigned_to_user_id = assigned_to_user_id;
      }

      let query = supabase
        .from('tickets')
        .update(updateData)
        .eq('id', id);

      if (last_updated_at) {
        query = query.eq('updated_at', last_updated_at);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      if (updateContent) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error: timelineError } = await supabase
          .from('ticket_updates')
          .insert([{
            ticket_id: id,
            content: updateContent,
            type: 'assignment',
            author: '',
            author_id: user.id,
            is_internal: false
          }]);

        if (timelineError) {
          if (previousAssignedTo !== undefined) {
            try {
              await supabase.from('tickets').update({ assigned_to: previousAssignedTo }).eq('id', id);
            } catch (revertErr) {
              console.error('[useUpdateTicketAssignment] Falha ao reverter atribuição:', revertErr);
            }
          }
          throw new Error(`Falha ao registrar histórico de atribuição: ${timelineError.message}. Operação cancelada.`);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Técnico atribuído',
        description: 'O técnico foi atribuído ao chamado com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useUpdateTicketAssignment', error);
      toast({
        title: 'Erro ao atribuir técnico',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface AssumeTicketParams {
  id: string;
  userId: string;
  userName: string;
  last_updated_at?: string | null;
}

export const useAssumeTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      userName,
      last_updated_at,
    }: AssumeTicketParams) => {
      let query = supabase
        .from('tickets')
        .update({
          assigned_to: userName,
          assigned_to_user_id: userId,
          status: 'in-progress'
        })
        .eq('id', id);

      if (last_updated_at) {
        query = query.eq('updated_at', last_updated_at);
      }

      const { data: ticketData, error: updateError } = await query
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw updateError;
      }

      // Safe timeline update
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: timelineError } = await supabase
          .from('ticket_updates')
          .insert([{
            ticket_id: id,
            content: `Chamado assumido por ${userName} (Status alterado para: Em Atendimento)`,
            type: 'assignment',
            author: '',
            author_id: user.id,
            is_internal: false
          }]);

        if (timelineError) {
          console.warn('[useAssumeTicket] Falha ao registrar timeline:', timelineError);
        }
      }

      return ticketData;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data?.id);
      toast({
        title: 'Chamado Assumido',
        description: `Você assumiu o chamado #${data?.ticket_number || ''} e o status foi alterado para Em Atendimento.`,
      });
    },
    onError: (error: Error) => {
      logError('useAssumeTicket', error);
      toast({
        title: 'Erro ao assumir chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    }
  });
};

export interface UpdatePriorityParams {
  id: string;
  priority: string;
  last_updated_at?: string | null;
  previousPriority?: string;
  updateContent?: string;
}

export const useUpdateTicketPriority = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      priority,
      last_updated_at,
      previousPriority,
      updateContent
    }: UpdatePriorityParams) => {
      const validated = ticketPrioritySchema.safeParse(priority);
      if (!validated.success) {
        throw new Error(validated.error.errors[0].message);
      }

      let query = supabase
        .from('tickets')
        .update({ priority: validated.data })
        .eq('id', id);

      if (last_updated_at) {
        query = query.eq('updated_at', last_updated_at);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      if (updateContent) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error: timelineError } = await supabase
          .from('ticket_updates')
          .insert([{
            ticket_id: id,
            content: updateContent,
            type: 'priority_change',
            author: '',
            author_id: user.id,
            is_internal: false
          }]);

        if (timelineError) {
          if (previousPriority) {
            try {
              await supabase.from('tickets').update({ priority: previousPriority }).eq('id', id);
            } catch (revertErr) {
              console.error('[useUpdateTicketPriority] Revert failed:', revertErr);
            }
          }
          throw new Error(`Falha ao registrar histórico de prioridade: ${timelineError.message}. Operação cancelada.`);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Prioridade alterada',
        description: 'A prioridade do chamado foi atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useUpdateTicketPriority', error);
      toast({
        title: 'Erro ao alterar prioridade',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface ResolveTicketParams {
  id: string;
  notes: string;
  resolutionContent: string;
  last_updated_at?: string | null;
  previousStatus?: string;
}

export const useResolveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
      resolutionContent,
      last_updated_at,
      previousStatus = 'in-progress'
    }: ResolveTicketParams) => {
      let query = supabase
        .from('tickets')
        .update({
          status: 'resolved',
          resolution_notes: notes,
          resolved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (last_updated_at) {
        query = query.eq('updated_at', last_updated_at);
      }

      const { data: updatedTicket, error: updateError } = await query
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw updateError;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const updatesToInsert = [
        {
          ticket_id: id,
          content: 'Status alterado para: Resolvido',
          type: 'status_change' as const,
          author: '',
          author_id: user.id,
          is_internal: false
        },
        {
          ticket_id: id,
          content: resolutionContent,
          type: 'comment' as const,
          author: '',
          author_id: user.id,
          is_internal: false
        }
      ];

      const { error: timelineError } = await supabase
        .from('ticket_updates')
        .insert(updatesToInsert);

      if (timelineError) {
        try {
          await supabase
            .from('tickets')
            .update({ status: previousStatus, resolution_notes: null, resolved_at: null })
            .eq('id', id);
        } catch (revertErr) {
          console.error('[useResolveTicket] Falha ao reverter resolução:', revertErr);
        }
        throw new Error(`Falha ao registrar histórico de resolução: ${timelineError.message}. Resolução cancelada e revertida.`);
      }

      return updatedTicket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Chamado Resolvido',
        description: 'O chamado foi resolvido com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useResolveTicket', error);
      toast({
        title: 'Erro ao resolver chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface EscalateTicketParams {
  id: string;
  technicianName: string;
  technicianUserId?: string | null;
  newPriority: string;
  reason: string;
  last_updated_at?: string | null;
  currentPriority?: string;
  currentAssignedTo?: string | null;
}

export const useEscalateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      technicianName,
      technicianUserId,
      newPriority,
      reason,
      last_updated_at,
      currentPriority,
      currentAssignedTo,
    }: EscalateTicketParams) => {
      const targetAssignedTo = technicianName === 'unassigned' ? null : technicianName;
      const priorityChanged = newPriority !== currentPriority;
      const assignmentChanged = targetAssignedTo !== currentAssignedTo;

      const updateData: Database['public']['Tables']['tickets']['Update'] = {};
      if (priorityChanged) updateData.priority = newPriority;
      if (assignmentChanged) {
        updateData.assigned_to = targetAssignedTo;
        if (technicianUserId !== undefined) {
          updateData.assigned_to_user_id = technicianUserId;
        }
      }

      let updatedTicket = null;
      if (Object.keys(updateData).length > 0) {
        let query = supabase
          .from('tickets')
          .update(updateData)
          .eq('id', id);

        if (last_updated_at) {
          query = query.eq('updated_at', last_updated_at);
        }

        const { data, error } = await query
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
          }
          throw error;
        }
        updatedTicket = data;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const updatesToInsert = [];

      if (priorityChanged) {
        updatesToInsert.push({
          ticket_id: id,
          content: `Prioridade escalada para: ${newPriority}`,
          type: 'priority_change' as const,
          author: '',
          author_id: user.id,
          is_internal: false,
        });
      }

      if (assignmentChanged) {
        updatesToInsert.push({
          ticket_id: id,
          content: `Chamado escalado para: ${technicianName === 'unassigned' ? 'Fila Geral' : technicianName}`,
          type: 'assignment' as const,
          author: '',
          author_id: user.id,
          is_internal: false,
        });
      }

      updatesToInsert.push({
        ticket_id: id,
        content: `[ESCALAÇÃO] Motivo: ${reason}`,
        type: 'comment' as const,
        author: '',
        author_id: user.id,
        is_internal: true,
      });

      const { error: timelineError } = await supabase
        .from('ticket_updates')
        .insert(updatesToInsert);

      if (timelineError) {
        if (Object.keys(updateData).length > 0) {
          try {
            const revertData: Database['public']['Tables']['tickets']['Update'] = {};
            if (priorityChanged && currentPriority) revertData.priority = currentPriority;
            if (assignmentChanged) revertData.assigned_to = currentAssignedTo;
            await supabase.from('tickets').update(revertData).eq('id', id);
          } catch (revertErr) {
            console.error('[useEscalateTicket] Falha ao reverter escalação:', revertErr);
          }
        }
        throw new Error(`Falha ao registrar histórico de escalação: ${timelineError.message}. Escalação cancelada e revertida.`);
      }

      return updatedTicket;
    },
    onSuccess: (data, variables) => {
      const ticketId = data?.id || variables.id;
      invalidateTicketQueries(queryClient, ticketId);
      toast({
        title: 'Chamado Escalado',
        description: 'O chamado foi escalado com sucesso e o histórico registrado.',
      });
    },
    onError: (error: Error) => {
      logError('useEscalateTicket', error);
      toast({
        title: 'Erro ao escalar chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export const useAddTicketUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (update: { ticket_id: string; content: string; type: string; is_internal?: boolean }) => {
      const validationResult = ticketUpdateSchema.safeParse(update);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const validData = validationResult.data;
      const { data, error } = await supabase
        .from('ticket_updates')
        .insert([{ 
          ticket_id: validData.ticket_id,
          content: validData.content,
          type: validData.type,
          author: '',
          author_id: user.id,
          is_internal: update.is_internal || false
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.ticket_id);
      toast({
        title: 'Comentário adicionado',
        description: 'Seu comentário foi adicionado com sucesso.',
      });
    },
    onError: (error) => {
      logError('useAddTicketUpdate', error);
      toast({
        title: 'Erro',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
    },
  });
};
