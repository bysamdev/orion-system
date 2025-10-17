import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Ticket[];
    },
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Ticket;
    },
    enabled: !!id,
  });
};

export const useTicketUpdates = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-updates', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
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
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('tickets')
        .update({ status })
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
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar o status do chamado.',
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
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atribuir o técnico.',
        variant: 'destructive',
      });
    },
  });
};

export const useAddTicketUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (update: { ticket_id: string; content: string; type: string }) => {
      // Author is set automatically by database trigger - we provide a placeholder
      const { data, error } = await supabase
        .from('ticket_updates')
        .insert([{ ...update, author: '' }])
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
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao adicionar o comentário.',
        variant: 'destructive',
      });
    },
  });
};
