import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { mapDatabaseError, logError } from '@/lib/error-handling';

export interface ReportSchedule {
  id: string;
  created_by: string;
  recipients: string[];
  frequency: 'weekly' | 'monthly';
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string;
  created_at: string;
}

export const useReportSchedules = () => {
  return useQuery({
    queryKey: ['report-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ReportSchedule[];
    },
  });
};

export const useCreateReportSchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipients, frequency }: { recipients: string[]; frequency: 'weekly' | 'monthly' }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('report_schedules')
        .insert({ created_by: user.id, recipients, frequency })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast({ title: 'Agendamento criado.' });
    },
    onError: (error) => {
      logError('useCreateReportSchedule', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};

export const useToggleReportSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('report_schedules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
    },
    onError: (error) => {
      logError('useToggleReportSchedule', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};

export const useDeleteReportSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('report_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast({ title: 'Agendamento removido.' });
    },
    onError: (error) => {
      logError('useDeleteReportSchedule', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};
