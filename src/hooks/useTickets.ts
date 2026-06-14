import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { toast } from '@/hooks/use-toast';
import { ticketStatusSchema, ticketUpdateSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';

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
  company_name: string | null;
  // Campos SLA
  sla_due_date: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_status: 'ok' | 'attention' | 'breached' | null;
  // Campos de Acesso Remoto
  remote_id: string | null;
  remote_password: string | null;
  sla_paused_at: string | null;
  sla_accumulated_pause_minutes: number | null;
  contract_id: string | null;
  asset_id: string | null;
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

export const useTickets = (status?: string) => {
  return useQuery({
    queryKey: ['tickets', status],
    queryFn: async () => {
      // Use read client for queries
      let query = supabaseRead
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
      // Fetch ticket, associated profile, and associated company in a single join query
      const { data: ticket, error } = await supabaseRead
        .from('tickets')
        .select(`
          *,
          profiles:user_id (
            full_name,
            company_id,
            companies:company_id (
              name
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Extract nested company name and format back to the expected Ticket interface structure
      let companyName = null;
      if (ticket.profiles && !Array.isArray(ticket.profiles)) {
        const profile = ticket.profiles as any;
        if (profile.companies && !Array.isArray(profile.companies)) {
          companyName = profile.companies.name;
        }
      }
      
      // Clean up the nested object to avoid polluting the state
      const cleanedTicket = { ...ticket };
      delete (cleanedTicket as any).profiles;

      const dynamicSlaStatus = ticket.sla_due_date ? calculateSlaStatus(ticket.sla_due_date) : ticket.sla_status;
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
      const { data: updates, error } = await supabaseRead
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
          authorName = (u.profiles as any).full_name || authorName;
        }

        // Clean up nested objects
        const cleanedUpdate = { ...u };
        delete (cleanedUpdate as any).profiles;

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

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      assigned_to, 
      assigned_to_user_id,
      sla_paused_at,
      sla_accumulated_pause_minutes
    }: { 
      id: string; 
      status: string;
      assigned_to?: string;
      assigned_to_user_id?: string;
      sla_paused_at?: string | null;
      sla_accumulated_pause_minutes?: number | null;
    }) => {
      // Validate status before sending to database
      const validationResult = ticketStatusSchema.safeParse(status);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      // Build update object
      const updateData: any = { status: validationResult.data };
      
      // Add assignment fields if provided
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

      const { data, error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', data.id] });
      
      // Mensagem customizada baseada no que foi atualizado
      const messages = [];
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
    onError: (error) => {
      logError('useUpdateTicketStatus', error);
      toast({
        title: 'Erro',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTicketAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string }) => {
      const { data, error } = await supabase
        .from('tickets')
        .update({ assigned_to })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', data.id] });
      toast({
        title: 'Técnico atribuído',
        description: 'O técnico foi atribuído ao chamado com sucesso.',
      });
    },
    onError: (error) => {
      logError('useUpdateTicketAssignment', error);
      toast({
        title: 'Erro',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
    },
  });
};

export const useAddTicketUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (update: { ticket_id: string; content: string; type: string; is_internal?: boolean }) => {
      // Validate input before sending to database
      const validationResult = ticketUpdateSchema.safeParse(update);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      // Get current user ID for author_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const validData = validationResult.data;
      const { data, error } = await supabase
        .from('ticket_updates')
        .insert([{ 
          ticket_id: validData.ticket_id,
          content: validData.content,
          type: validData.type,
          author: '', // Placeholder - trigger will set display name
          author_id: user.id,
          is_internal: update.is_internal || false
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-updates', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
