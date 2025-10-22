import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para escutar mudanças em tempo real nos tickets
 * Atualiza automaticamente as queries quando há mudanças no banco
 */
export const useRealtimeTickets = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('Ticket atualizado em tempo real:', payload);
          
          // Invalidar todas as queries de tickets para recarregar dados
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
          
          // Se houver um ID específico, invalidar também
          if (payload.new && 'id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['ticket', payload.new.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Hook para escutar mudanças em tempo real em um ticket específico
 */
export const useRealtimeTicket = (ticketId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-${ticketId}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        (payload) => {
          console.log('Ticket específico atualizado:', payload);
          
          // Invalidar queries relacionadas a este ticket
          queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);
};
