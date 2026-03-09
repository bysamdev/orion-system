import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { toast } from '@/hooks/use-toast';

export interface TimeEntry {
  id: string;
  ticket_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  description: string | null;
  billable: boolean;
  created_at: string;
}

/** Buscar time_entries de um ticket */
export const useTicketTimeEntries = (ticketId: string) => {
  return useQuery({
    queryKey: ['time-entries', ticketId],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('time_entries')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return (data || []) as TimeEntry[];
    },
    enabled: !!ticketId,
  });
};

/** Buscar timer ativo do usuário logado */
export const useActiveTimer = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['active-timer', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabaseRead
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .is('end_time', null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!userId,
    refetchInterval: 10000,
  });
};

/** Iniciar timer */
export const useStartTimer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, userId }: { ticketId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          start_time: new Date().toISOString(),
          billable: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      toast({ title: 'Timer iniciado', description: 'Apontamento de horas em andamento.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível iniciar o timer.', variant: 'destructive' });
    },
  });
};

/** Parar timer */
export const useStopTimer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const now = new Date();
      // Primeiro buscar o start_time
      const { data: entry } = await supabaseRead
        .from('time_entries')
        .select('start_time')
        .eq('id', entryId)
        .single();

      const startTime = entry ? new Date(entry.start_time) : now;
      const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          end_time: now.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', entryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', data.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      toast({ title: 'Timer parado', description: `${data.duration_minutes} minutos registrados.` });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível parar o timer.', variant: 'destructive' });
    },
  });
};
