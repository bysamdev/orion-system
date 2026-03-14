import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { toast } from '@/hooks/use-toast';

export interface TicketRating {
  id: string;
  ticket_id: string;
  rating: number;
  comment: string | null;
  user_id: string;
  created_at: string;
}

export const useTicketRating = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-rating', ticketId],
    queryFn: async () => {
      const { data, error } = await (supabaseRead
        .from('ticket_ratings' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle() as any);
      if (error) throw error;
      return data as TicketRating | null;
    },
    enabled: !!ticketId,
  });
};

export const useAddTicketRating = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, rating, comment, userId }: { ticketId: string; rating: number; comment?: string; userId: string }) => {
      const { data, error } = await (supabase
        .from('ticket_ratings' as any)
        .insert({
          ticket_id: ticketId,
          rating,
          comment,
          user_id: userId
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rating', data.ticket_id] });
      toast({ title: 'Obrigado!', description: 'Sua avaliação foi registrada com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível registrar sua avaliação.', variant: 'destructive' });
    },
  });
};
