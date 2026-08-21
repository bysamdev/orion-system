import { useEffect } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Escuta mudanças em tempo real na tabela machines (status, snapshot de
 * CPU/RAM/disco a cada heartbeat) e invalida as queries que dependem dela.
 * Um canal por empresa (companyId) — antes era um único canal global sem
 * filtro, então o heartbeat de QUALQUER máquina de QUALQUER empresa
 * invalidava as queries de monitoramento de TODO navegador com essa tela
 * aberta, mesmo sem nenhuma relação com a empresa do usuário. RLS já
 * impedia o payload de vazar entre empresas, mas o refetch desnecessário
 * multiplicava por número de empresas ativas no sistema.
 *
 * companyId undefined (usuário developer/master, escopo global — ver
 * escopo.Global() no backend) mantém o canal sem filtro, já que esse perfil
 * legitimamente precisa ver atualização de qualquer empresa.
 *
 * Gerenciamento de canal compartilhado com Set de subscribers por
 * companyId, pra evitar vazamento de memória ou perda de listeners em
 * trocas de rota (mesmo desenho de antes, só que por chave).
 */
type ChannelEntry = { channel: RealtimeChannel; subscribers: Set<QueryClient> };
const channels = new Map<string, ChannelEntry>();

function notifySubscribers(entry: ChannelEntry) {
  entry.subscribers.forEach((qc) => {
    try {
      qc.invalidateQueries({ queryKey: ['monitoring'] });
      qc.invalidateQueries({ queryKey: ['device-inventory'] });
    } catch (e) {
      console.warn('[useRealtimeMachines] Erro ao invalidar queries:', e);
    }
  });
}

export const useRealtimeMachines = (companyId?: string) => {
  const queryClient = useQueryClient();
  const key = companyId || '_global';

  useEffect(() => {
    let entry = channels.get(key);
    if (!entry) {
      const channel = supabase
        .channel(`machines-realtime-${key}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'machines',
            ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
          },
          () => {
            const current = channels.get(key);
            if (current) notifySubscribers(current);
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useRealtimeMachines] Erro no canal realtime machines', key);
          }
        });
      entry = { channel, subscribers: new Set() };
      channels.set(key, entry);
    }
    entry.subscribers.add(queryClient);

    return () => {
      const current = channels.get(key);
      if (!current) return;
      current.subscribers.delete(queryClient);
      if (current.subscribers.size === 0) {
        channels.delete(key);
        try {
          supabase.removeChannel(current.channel);
        } catch (err) {
          console.warn('[useRealtimeMachines] Erro ao remover canal realtime:', err);
        }
      }
    };
  }, [queryClient, key, companyId]);
};
