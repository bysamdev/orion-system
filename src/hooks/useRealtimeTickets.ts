import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useRealtimeTickets = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('Ticket change detected:', payload);
          
          // Invalidate all ticket queries
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
          if (payload.new && 'id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['ticket', payload.new.id] });
          }
          
          // Show notification based on event type
          if (payload.eventType === 'INSERT') {
            toast({
              title: '🎫 Novo Chamado',
              description: `Chamado #${payload.new.ticket_number} criado`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const statusChanged = payload.old?.status !== payload.new?.status;
            if (statusChanged) {
              toast({
                title: '📝 Status Atualizado',
                description: `Chamado #${payload.new.ticket_number}: ${payload.new.status}`,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_updates'
        },
        (payload) => {
          console.log('New ticket update:', payload);
          
          // Invalidate ticket updates queries
          queryClient.invalidateQueries({ 
            queryKey: ['ticket-updates', payload.new.ticket_id] 
          });
          
          toast({
            title: '💬 Nova Atualização',
            description: 'Um comentário foi adicionado ao chamado',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
