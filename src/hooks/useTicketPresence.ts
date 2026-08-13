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

    const channelName = `ticket-presence:${ticketId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeViewers: Viewer[] = [];

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            activeViewers.push(presence as Viewer);
          });
        });

        // Deduplicate viewers by user_id
        const uniqueViewers = Array.from(new Map(activeViewers.map(v => [v.user_id, v])).values());
        
        setViewers(uniqueViewers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const userName = profile?.full_name || user.email || 'Usuário Desconhecido';
          await channel.track({
            user_id: user.id,
            name: userName,
            entered_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, user, profile?.full_name]);

  const otherViewers = viewers.filter((v) => v.user_id !== user?.id);

  return { viewers, otherViewers };
};
