import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TicketRating {
  id: string;
  ticket_id: string;
  /** NULL quando o cliente pulou a avaliação. Ver `skipped`. */
  rating: number | null;
  comment: string | null;
  user_id: string;
  /** Separa "pulou" de "não respondeu" — sem isso a métrica de satisfação mente. */
  skipped: boolean;
  created_at: string;
}

export const useTicketRating = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-rating', ticketId],
    queryFn: async () => {
      const { data, error } = await (supabase
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

interface AddTicketRatingParams {
  ticketId: string;
  /** Omitido (ou nulo) quando `skipped` é true. */
  rating?: number;
  comment?: string;
  skipped?: boolean;
}

/**
 * user_id não é mais enviado pelo cliente: a coluna tem DEFAULT auth.uid() e a
 * policy de INSERT exige user_id = auth.uid(). Enviar do front só criava a
 * chance de assinar a avaliação com o id de outra pessoa.
 */
export const useAddTicketRating = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, rating, comment, skipped = false }: AddTicketRatingParams) => {
      const { data, error } = await (supabase
        .from('ticket_ratings' as any)
        .insert({
          ticket_id: ticketId,
          rating: skipped ? null : rating,
          comment: skipped ? null : comment,
          skipped,
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data as TicketRating;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rating', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['avaliacao-pendente'] });
      toast(
        data.skipped
          ? { title: 'Avaliação dispensada', description: 'Você pode avaliar depois, pela tela do chamado.' }
          : { title: 'Obrigado!', description: 'Sua avaliação foi registrada com sucesso.' }
      );
    },
    onError: (error: { code?: string }) => {
      // 23505 = já existe avaliação para este chamado. Não é falha do usuário:
      // acontece em duplo clique ou em duas abas.
      if (error?.code === '23505') {
        queryClient.invalidateQueries({ queryKey: ['avaliacao-pendente'] });
        toast({ title: 'Este chamado já foi avaliado', description: 'Nada a fazer — sua resposta anterior foi mantida.' });
        return;
      }
      toast({ title: 'Erro', description: 'Não foi possível registrar sua avaliação.', variant: 'destructive' });
    },
  });
};
