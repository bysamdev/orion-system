import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { subDays, startOfDay, format } from 'date-fns';

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
      const startDate = subDays(endDate, days);

      const dataPoints: HistoricalDataPoint[] = [];

      // Generate data for each day
      for (let i = 0; i < days; i++) {
        const currentDay = startOfDay(subDays(endDate, days - i - 1));
        const nextDay = startOfDay(subDays(endDate, days - i));

        // Get tickets opened on this day
        const { data: openedTickets, error: openedError } = await supabaseRead
          .from('tickets')
          .select('id', { count: 'exact' })
          .gte('created_at', currentDay.toISOString())
          .lt('created_at', nextDay.toISOString());

        if (openedError) throw openedError;

        // Get tickets solved on this day
        const { data: solvedTickets, error: solvedError } = await supabaseRead
          .from('tickets')
          .select('id', { count: 'exact' })
          .in('status', ['resolved', 'closed'])
          .gte('updated_at', currentDay.toISOString())
          .lt('updated_at', nextDay.toISOString());

        if (solvedError) throw solvedError;

        dataPoints.push({
          date: format(currentDay, 'dd/MM'),
          opened: openedTickets?.length || 0,
          solved: solvedTickets?.length || 0,
        });
      }

      return dataPoints;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
