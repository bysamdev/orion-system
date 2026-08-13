// Fontes de dados que o relatório passou a consumir e que a página antiga não lia:
// meta contratual de SLA, satisfação (CSAT) e horas lançadas.
//
// Todas seguem indo direto ao Supabase sob RLS — nenhuma passa pelo backend Go,
// que conecta com papel privilegiado e exigiria recorte de empresa manual
// (o problema documentado em handler/mon_handlers.go após o pentest).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SlaTarget } from '@/lib/reports/types';
import type { TimeEntryRow } from '@/lib/reports/aggregations';

/**
 * Meta contratual de horas por prioridade.
 *
 * Quando há empresa filtrada, usa a config dela; sem filtro (ou sem config
 * própria), cai na primeira configuração cadastrada como referência geral.
 * Retorna null se não houver nenhuma — nesse caso os Bullet Charts somem em vez
 * de exibirem uma meta arbitrada.
 */
export const useSlaTarget = (companyId: string) => {
  return useQuery({
    queryKey: ['report-sla-target', companyId],
    queryFn: async (): Promise<SlaTarget | null> => {
      const { data, error } = await supabase
        .from('sla_configs')
        .select('name, company_id, urgent_hours, high_hours, medium_hours, low_hours');
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const daEmpresa = companyId !== 'all' ? data.find((c) => c.company_id === companyId) : null;
      const escolhida = daEmpresa ?? data[0];

      return {
        urgentHours: escolhida.urgent_hours,
        highHours: escolhida.high_hours,
        mediumHours: escolhida.medium_hours,
        lowHours: escolhida.low_hours,
        sourceName: daEmpresa ? escolhida.name : `${escolhida.name} (padrão)`,
      };
    },
  });
};

/**
 * Avaliações de satisfação, indexadas por ticket.
 *
 * `ticket_ratings` existe via migration (20260314080000) mas ainda não está nos
 * types gerados do Supabase, daí o cast. Falha aqui não derruba o relatório:
 * sem avaliações o comparativo de técnicos simplesmente omite a dimensão CSAT.
 */
export const useTicketRatings = () => {
  return useQuery({
    queryKey: ['report-ticket-ratings'],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('ticket_ratings' as never)
        .select('ticket_id, rating');
      if (error) throw error;

      const mapa = new Map<string, number>();
      for (const r of (data ?? []) as Array<{ ticket_id: string; rating: number }>) {
        mapa.set(r.ticket_id, r.rating);
      }
      return mapa;
    },
    // Ausência de avaliações é cenário normal, não erro que mereça retentativa.
    retry: false,
  });
};

export interface CriticalAssets {
  offline: number;
  alerta: number;
  total: number;
  /** Amostra curta para o bloco executivo — não é a lista completa. */
  exemplos: Array<{ name: string; status: string; hostname: string | null }>;
}

/**
 * Ativos em estado crítico (offline ou em alerta).
 *
 * Lê `assets` via Supabase sob RLS. Deliberadamente NÃO chama
 * /api/monitoring/dashboard no Go: aquele endpoint conecta com papel
 * privilegiado e o recorte por empresa é manual, então usá-lo aqui ampliaria a
 * superfície multitenant sem necessidade.
 */
export const useCriticalAssets = (companyId: string) => {
  return useQuery({
    queryKey: ['report-critical-assets', companyId],
    queryFn: async (): Promise<CriticalAssets> => {
      let q = supabase.from('assets').select('name, status, hostname, company_id');
      if (companyId !== 'all') q = q.eq('company_id', companyId);

      const { data, error } = await q;
      if (error) throw error;

      const linhas = data ?? [];
      const criticos = linhas.filter((a) => a.status === 'offline' || a.status === 'alerta');

      return {
        offline: linhas.filter((a) => a.status === 'offline').length,
        alerta: linhas.filter((a) => a.status === 'alerta').length,
        total: linhas.length,
        exemplos: criticos.slice(0, 5).map((a) => ({
          name: a.name,
          status: a.status,
          hostname: a.hostname ?? null,
        })),
      };
    },
    retry: false,
  });
};

/** Apontamentos de horas. A filtragem por escopo acontece na agregação. */
export const useTimeEntriesReport = () => {
  return useQuery({
    queryKey: ['report-time-entries'],
    queryFn: async (): Promise<TimeEntryRow[]> => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('user_id, ticket_id, duration_minutes, billable');
      if (error) throw error;
      return (data ?? []) as TimeEntryRow[];
    },
    retry: false,
  });
};
