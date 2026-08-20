import { useEffect } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Escuta mudanças em tempo real na tabela machines (status, snapshot de
 * CPU/RAM/disco a cada heartbeat) e invalida as queries que dependem dela.
 * Utiliza gerenciamento seguro de canal compartilhado com Set de subscribers
 * para evitar vazamento de memória ou perda de listeners em trocas de rota.
 */
const subscribers = new Set<QueryClient>();
let globalChannel: RealtimeChannel | null = null;

function notifySubscribers() {
  subscribers.forEach((qc) => {
    try {
      qc.invalidateQueries({ queryKey: ['monitoring'] });
      qc.invalidateQueries({ queryKey: ['device-inventory'] });
    } catch (e) {
      console.warn('[useRealtimeMachines] Erro ao invalidar queries:', e);
    }
  });
}

export const useRealtimeMachines = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    subscribers.add(queryClient);

    if (!globalChannel) {
      globalChannel = supabase
        .channel('machines-realtime-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'machines',
          },
          () => {
            notifySubscribers();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useRealtimeMachines] Erro no canal realtime machines');
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
          console.warn('[useRealtimeMachines] Erro ao remover canal realtime:', err);
        }
      }
    };
  }, [queryClient]);
};
