import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';

export type ReportMode = 'created' | 'active';

export interface ReportMetrics {
  total: number;
  abertos: number;
  resolvidos: number;
  cancelados: number;
  slaEstourado: number;
  tempoMedioHoras: number | null;
}

interface UseReportMetricsParams {
  mode: ReportMode;
  dateFrom: string;
  dateTo: string;
  companyId?: string | null;
  techId?: string | null;
}

const EMPTY_METRICS: ReportMetrics = {
  total: 0,
  abertos: 0,
  resolvidos: 0,
  cancelados: 0,
  slaEstourado: 0,
  tempoMedioHoras: null,
};

export const useReportMetrics = ({
  mode,
  dateFrom,
  dateTo,
  companyId,
  techId,
}: UseReportMetricsParams) => {
  const rpcName =
    mode === 'created'
      ? 'get_reports_created_in_period'
      : 'get_reports_active_in_period';

  return useQuery({
    queryKey: ['report-metrics', mode, dateFrom, dateTo, companyId, techId],
    queryFn: async (): Promise<ReportMetrics> => {
      const { data, error } = await supabaseRead.rpc(rpcName as any, {
        p_start_date: new Date(dateFrom).toISOString(),
        p_end_date: new Date(dateTo + 'T23:59:59').toISOString(),
        p_company_id: companyId || null,
        p_tech_id: techId || null,
      });

      if (error) throw error;
      if (!data) return EMPTY_METRICS;

      const raw = data as any;
      return {
        total: Number(raw.total ?? 0),
        abertos: Number(raw.abertos ?? 0),
        resolvidos: Number(raw.resolvidos ?? 0),
        cancelados: Number(raw.cancelados ?? 0),
        slaEstourado: Number(raw.sla_estourado ?? 0),
        tempoMedioHoras: raw.tempo_medio_horas != null ? Number(raw.tempo_medio_horas) : null,
      };
    },
    enabled: !!(dateFrom && dateTo),
    staleTime: 60_000,
  });
};
