import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';
import type { Ticket } from '@/hooks/useTickets';
import type { ReportMode } from '@/hooks/useReportMetrics';

interface UseReportTicketsParams {
  mode: ReportMode;
  dateFrom: string;
  dateTo: string;
  companyId?: string | null;
  techId?: string | null;
}

export const useReportTickets = ({
  mode,
  dateFrom,
  dateTo,
  companyId,
  techId,
}: UseReportTicketsParams) => {
  return useQuery({
    queryKey: ['report-tickets', mode, dateFrom, dateTo, companyId, techId],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabaseRead.rpc('get_reports_tickets' as any, {
        p_mode: mode,
        p_start_date: new Date(dateFrom).toISOString(),
        p_end_date: new Date(dateTo + 'T23:59:59').toISOString(),
        p_company_id: companyId || null,
        p_tech_id: techId || null,
      });

      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];

      const enriched = await enrichTicketsWithCompany(data as any[]);
      return (enriched as any[]).map((t: any) => ({
        ...t,
        sla_status: t.sla_due_date
          ? calculateSlaStatus(t.sla_due_date, t.created_at, t.resolved_at)
          : t.sla_status,
      })) as Ticket[];
    },
    enabled: !!(dateFrom && dateTo),
    staleTime: 60_000,
  });
};
