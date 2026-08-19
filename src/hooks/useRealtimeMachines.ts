import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Escuta mudanças em tempo real na tabela machines (status, snapshot de
 * CPU/RAM/disco a cada heartbeat) e invalida as queries que dependem dela —
 * mesmo padrão de useRealtimeTickets. RLS do Supabase já filtra o que cada
 * conexão recebe, então isso não vaza dado entre empresas.
 */
let globalChannel: RealtimeChannel | null = null;
let subscriptionCount = 0;

export const useRealtimeMachines = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    subscriptionCount++;

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
            queryClient.invalidateQueries({ queryKey: ['monitoring'] });
            queryClient.invalidateQueries({ queryKey: ['device-inventory'] });
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
