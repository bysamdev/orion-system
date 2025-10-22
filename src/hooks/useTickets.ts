import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { toast } from '@/hooks/use-toast';
import { ticketStatusSchema, ticketUpdateSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';

export interface Ticket {
  id: string;
  ticket_number: number;
  title: string;
  description: string;
  requester_name: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  operator_name: string | null;
  assigned_to: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  company_name: string | null;
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  author: string;
  content: string;
  type: 'created' | 'status' | 'assignment' | 'comment';
  created_at: string;
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
        query = query.eq('status', status);
      }

      const { data: tickets, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
      
      if (!tickets || tickets.length === 0) {
        return [];
      }

      // Fetch user profiles and companies separately (using read client)
      const userIds = [...new Set(tickets.map(t => t.user_id))];
      const { data: profiles } = await supabaseRead
        .from('profiles')
        .select('id, full_name, company_id, companies(name)')
        .in('id', userIds);

      // Map profiles by user_id for easy lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Combine tickets with profile data
      const enrichedTickets = tickets.map((ticket: any) => {
        const profile = profileMap.get(ticket.user_id);
        return {
          ...ticket,
          company_name: profile?.companies?.name || null,
        };
      }) as Ticket[];
      
      return enrichedTickets;
    },
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      // Use read client for queries
      const { data: ticket, error } = await supabaseRead
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Fetch profile and company data separately (using read client)
      const { data: profile } = await supabaseRead
        .from('profiles')
        .select('full_name, company_id, companies(name)')
        .eq('id', ticket.user_id)
        .single();
      
      // Include company_name
      const enrichedTicket = {
        ...ticket,
        company_name: profile?.companies?.name || null,
      } as Ticket;
      
      return enrichedTicket;
    },
    enabled: !!id,
  });
};

export const useTicketUpdates = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-updates', ticketId],
    queryFn: async () => {
      // Use read client for queries
      const { data, error } = await supabaseRead
        .from('ticket_updates')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TicketUpdate[];
    },
    enabled: !!ticketId,
  });
};

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      assigned_to, 
      assigned_to_user_id 
    }: { 
      id: string; 
      status: string;
      assigned_to?: string;
      assigned_to_user_id?: string;
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
      toast({
        title: 'Status atualizado',
        description: 'O status do chamado foi atualizado com sucesso.',
      });
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
    mutationFn: async (update: { ticket_id: string; content: string; type: string }) => {
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
          author_id: user.id 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-updates', data.ticket_id] });
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
