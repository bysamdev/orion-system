import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardKPIs {
  open_tickets: number;
  resolved_today: number;
  avg_resolution_hours: number | null;
  sla_violated: number;
}

interface ChartDataItem {
  name: string;
  value: number;
}

interface DailyVolumeItem {
  date: string;
  opened: number;
  resolved: number;
}

interface DashboardStats {
  kpis: DashboardKPIs;
  by_department: ChartDataItem[];
  by_status: ChartDataItem[];
  daily_volume: DailyVolumeItem[];
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      
      if (error) {
        throw error;
      }
      
      const result = data as unknown as DashboardStats | { error: string };
      
      // Verificar se retornou erro de permissão
      if ('error' in result && typeof result.error === 'string') {
        throw new Error(result.error);
      }
      
      return result as DashboardStats;
    },
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });
};
