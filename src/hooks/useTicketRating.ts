import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';

/**
 * Vem do schema gerado. `rating` é NULL quando o cliente pulou (`skipped`),
 * que separa "pulou" de "não respondeu" — sem essa distinção a métrica de
 * satisfação mente.
 */
export type TicketRating = Database['public']['Tables']['ticket_ratings']['Row'];

export const useTicketRating = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-rating', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_ratings')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle();
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('ticket_ratings')
        .insert({
          ticket_id: ticketId,
          rating: skipped ? null : rating,
          comment: skipped ? null : comment,
          skipped,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
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

interface UpdateTicketRatingParams {
  id: string;
  ticketId: string;
  rating?: number;
  comment?: string;
  skipped?: boolean;
}

/**
 * Correção dentro da janela de 15 minutos.
 *
 * Fora da janela a policy nega pelo USING, o que no PostgREST devolve sucesso
 * com zero linhas — não erro. Por isso o `.select()` e a checagem de `data`:
 * sem ela, uma correção tardia pareceria ter funcionado.
 *
 * created_at, user_id e ticket_id não são enviados de propósito: o trigger
 * preserva_identidade_da_avaliacao os devolve à linha antiga de qualquer forma.
 */
export const useUpdateTicketRating = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rating, comment, skipped = false }: UpdateTicketRatingParams) => {
      const { data, error } = await supabase
        .from('ticket_ratings')
        .update({
          rating: skipped ? null : rating,
          comment: skipped ? null : comment,
          skipped,
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('JANELA_EXPIRADA');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rating', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['avaliacao-pendente'] });
      toast({ title: 'Avaliação atualizada', description: 'Sua correção foi registrada.' });
    },
    onError: (error: Error) => {
      if (error?.message === 'JANELA_EXPIRADA') {
        toast({
          title: 'Prazo de correção encerrado',
          description: 'Avaliações só podem ser corrigidas nos primeiros 15 minutos.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Erro', description: 'Não foi possível atualizar sua avaliação.', variant: 'destructive' });
    },
  });
};
