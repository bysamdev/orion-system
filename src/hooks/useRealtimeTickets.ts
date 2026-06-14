import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para escutar mudanças em tempo real nos tickets
 * Atualiza automaticamente as queries quando há mudanças no banco
 */
import { RealtimeChannel } from '@supabase/supabase-js';

let globalChannel: RealtimeChannel | null = null;
let subscriptionCount = 0;

export const useRealtimeTickets = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    subscriptionCount++;

    if (!globalChannel) {
      globalChannel = supabase
        .channel('tickets-realtime-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets'
          },
          (payload) => {
            console.log('Ticket atualizado em tempo real:', payload);
            
            // Invalidar todas as queries de tickets relacionadas ao dashboard do técnico
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
            queryClient.invalidateQueries({ queryKey: ['sla-at-risk-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['my-active-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['my-recent-closed'] });
            
            // Se houver um ID específico, invalidar também
            if (payload.new && 'id' in payload.new) {
              queryClient.invalidateQueries({ queryKey: ['ticket', payload.new.id] });
            }
          }
        )
        .subscribe();
    }

    return () => {
      subscriptionCount--;
      if (subscriptionCount <= 0 && globalChannel) {
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        subscriptionCount = 0;
      }
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

    const channelName = `ticket-${ticketId}-realtime`;
    const channel = supabase
      .channel(channelName)
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
