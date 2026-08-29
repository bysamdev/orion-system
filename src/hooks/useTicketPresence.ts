import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserRole';

export interface Viewer {
  user_id: string;
  name: string;
  entered_at: string;
}

export const useTicketPresence = (ticketId: string | undefined) => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!ticketId || !user) return;

    let isMounted = true;
    const channelName = `ticket-presence:${ticketId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!isMounted) return;
        const state = channel.presenceState();
        const activeViewers: Viewer[] = [];

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            activeViewers.push(presence as Viewer);
          });
        });

        // Deduplicate viewers by user_id
        const uniqueViewers = Array.from(new Map(activeViewers.map(v => [v.user_id, v])).values());
        
        if (isMounted) {
          setViewers(uniqueViewers);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          const userName = profile?.full_name || user.email || 'Usuário Desconhecido';
          try {
            await channel.track({
              user_id: user.id,
              name: userName,
              entered_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('[useTicketPresence] Erro ao rastrear presença:', e);
          }
        }
      });

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn('[useTicketPresence] Erro ao remover canal realtime:', err);
      }
    };
  }, [ticketId, user, profile?.full_name]);

  const otherViewers = viewers.filter((v) => v.user_id !== user?.id);

  return { viewers, otherViewers };
};
