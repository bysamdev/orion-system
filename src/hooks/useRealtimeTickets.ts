import { useEffect } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook para escutar mudanças em tempo real nos tickets
 * Atualiza automaticamente as queries quando há mudanças no banco.
 * Utiliza Set de subscribers para teardown seguro de canal compartilhado.
 */
const subscribers = new Set<QueryClient>();
let globalChannel: RealtimeChannel | null = null;

function notifyTicketSubscribers(payload: any) {
  subscribers.forEach((qc) => {
    try {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['all-active-tickets'] });
      qc.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
      qc.invalidateQueries({ queryKey: ['sla-at-risk-tickets'] });
      qc.invalidateQueries({ queryKey: ['my-active-tickets'] });
      qc.invalidateQueries({ queryKey: ['my-recent-closed'] });
      qc.invalidateQueries({ queryKey: ['technician-stats'] });
      qc.invalidateQueries({ queryKey: ['technician-workload'] });
      qc.invalidateQueries({ queryKey: ['team-workload'] });
      qc.invalidateQueries({ queryKey: ['meus-tickets'] });
      qc.invalidateQueries({ queryKey: ['portal-open-tickets'] });

      if (payload?.new && 'id' in payload.new) {
        qc.invalidateQueries({ queryKey: ['ticket', payload.new.id] });
      }
    } catch (err) {
      console.warn('[useRealtimeTickets] Erro ao invalidar queries:', err);
    }
  });
}

export const useRealtimeTickets = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    subscribers.add(queryClient);

    if (!globalChannel) {
      globalChannel = supabase
        .channel('tickets-realtime-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
          },
          (payload) => {
            notifyTicketSubscribers(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useRealtimeTickets] Erro no canal realtime tickets');
          }
        });
    }

    return () => {
      subscribers.delete(queryClient);
      if (subscribers.size === 0 && globalChannel) {
        const channelToTeardown = globalChannel;
        globalChannel = null;
        try {
          supabase.removeChannel(channelToTeardown);
        } catch (err) {
          console.warn('[useRealtimeTickets] Erro ao remover canal realtime:', err);
        }
      }
    };
  }, [queryClient]);
};

/**
 * Hook para escutar mudanças em tempo real em um ticket específico
 */
export const useRealtimeTicket = (ticketId: string | undefined | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ticketId) return;

    const channelName = `ticket-${ticketId}-realtime-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`,
        },
        () => {
          try {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
          } catch (e) {
            console.warn('[useRealtimeTicket] Erro ao invalidar ticket:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[useRealtimeTicket] Erro no canal realtime do ticket ${ticketId}`);
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn('[useRealtimeTicket] Erro ao remover canal realtime:', err);
      }
    };
  }, [ticketId, queryClient]);
};
