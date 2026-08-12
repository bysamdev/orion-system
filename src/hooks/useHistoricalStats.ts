import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, addDays, format } from 'date-fns';

export interface HistoricalDataPoint {
  date: string;
  opened: number;
  solved: number;
}

export const useHistoricalStats = (days: number = 7) => {
  return useQuery({
    queryKey: ['historical-stats', days],
    queryFn: async () => {
      const endDate = new Date();
      const rangeStart = startOfDay(subDays(endDate, days - 1));

      // Uma ida ao banco por métrica (não uma por dia): busca tudo que cai
      // na janela de uma vez e distribui por dia no cliente.
      const [openedResult, solvedResult] = await Promise.all([
        supabase
          .from('tickets')
          .select('created_at')
          .gte('created_at', rangeStart.toISOString()),
        supabase
          .from('tickets')
          .select('updated_at')
          .in('status', ['resolved', 'closed'])
          .gte('updated_at', rangeStart.toISOString()),
      ]);

      if (openedResult.error) throw openedResult.error;
      if (solvedResult.error) throw solvedResult.error;

      const opened = openedResult.data ?? [];
      const solved = solvedResult.data ?? [];

      const dataPoints: HistoricalDataPoint[] = [];

      for (let i = 0; i < days; i++) {
        const dayStart = startOfDay(subDays(endDate, days - 1 - i));
        const dayEnd = addDays(dayStart, 1);
        const dayStartISO = dayStart.toISOString();
        const dayEndISO = dayEnd.toISOString();

        dataPoints.push({
          date: format(dayStart, 'dd/MM'),
          opened: opened.filter((t) => t.created_at >= dayStartISO && t.created_at < dayEndISO).length,
          solved: solved.filter((t) => t.updated_at >= dayStartISO && t.updated_at < dayEndISO).length,
        });
      }

      return dataPoints;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
