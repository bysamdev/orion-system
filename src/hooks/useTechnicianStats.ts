import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay } from 'date-fns';
import { calculateSlaStatus } from '@/lib/ticket-helpers';

/**
 * Hook para buscar estatísticas pessoais do técnico logado
 */
export const useTechnicianStats = (userId: string | undefined, role?: string) => {
  return useQuery({
    queryKey: ['technician-stats', userId, role],
    queryFn: async () => {
      if (!userId) return null;

      const now = new Date();
      const today = startOfDay(now);
      const isAdminOrDev = role === 'admin' || role === 'developer';

      // 1. Em Atendimento
      let inProgressQuery = supabase
        .from('tickets')
        .select('id')
        .eq('status', 'in-progress');

      if (!isAdminOrDev) {
        inProgressQuery = inProgressQuery.eq('assigned_to_user_id', userId);
      }

      const { data: inProgressTickets, error: inProgressError } = await inProgressQuery;
      if (inProgressError) throw inProgressError;

      // 2. Resolvidos Hoje
      let resolvedQuery = supabase
        .from('tickets')
        .select('id')
        .in('status', ['resolved', 'closed'])
        .gte('resolved_at', today.toISOString());

      if (!isAdminOrDev) {
        resolvedQuery = resolvedQuery.eq('assigned_to_user_id', userId);
      }

      const { data: resolvedToday, error: resolvedError } = await resolvedQuery;
      if (resolvedError) throw resolvedError;

      // 3. SLA em Risco e Breached
      let activeQuery = supabase
        .from('tickets')
        .select('id, sla_due_date, created_at')
        .not('status', 'in', '("resolved","closed","cancelled")');

      if (!isAdminOrDev) {
        activeQuery = activeQuery.eq('assigned_to_user_id', userId);
      }

      const { data: activeTickets, error: activeError } = await activeQuery;
      if (activeError) throw activeError;

      let slaAtRiskCount = 0;
      let slaBreachedCount = 0;

      activeTickets?.forEach(ticket => {
        const status = calculateSlaStatus(ticket.sla_due_date, ticket.created_at);
        if (status === 'breached') {
          slaBreachedCount++;
        } else if (status === 'warning' || status === 'attention') {
          slaAtRiskCount++;
        }
      });

      // 4. Pendentes
      let pendingQuery = supabase
        .from('tickets')
        .select('id')
        .in('status', ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party']);

      if (!isAdminOrDev) {
        pendingQuery = pendingQuery.eq('assigned_to_user_id', userId);
      }

      const { data: pendingTickets, error: pendingError } = await pendingQuery;
      if (pendingError) throw pendingError;

      return {
        inProgress: inProgressTickets?.length || 0,
        resolvedToday: resolvedToday?.length || 0,
        slaAtRisk: slaAtRiskCount + slaBreachedCount,
        pending: pendingTickets?.length || 0,
      };
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
};

/**
 * Hook para buscar distribuição de tickets do técnico por status
 */
export const useTechnicianWorkload = (userId: string | undefined, role?: string) => {
  return useQuery({
    queryKey: ['technician-workload', userId, role],
    queryFn: async () => {
      if (!userId) return null;

      const isAdminOrDev = role === 'admin' || role === 'developer';

      let query = supabase
        .from('tickets')
        .select('status')
        .not('status', 'in', '("resolved","closed","cancelled")');

      if (!isAdminOrDev) {
        query = query.eq('assigned_to_user_id', userId);
      }

      const { data: tickets, error } = await query;

      if (error) throw error;

      // Agrupar por status
      const statusCount: Record<string, number> = {
        open: 0,
        'in-progress': 0,
        reopened: 0,
        'awaiting-customer': 0,
        'awaiting-third-party': 0,
      };

      tickets?.forEach(ticket => {
        if (statusCount[ticket.status] !== undefined) {
          statusCount[ticket.status]++;
        }
      });

      return [
        { name: 'Abertos', value: statusCount['open'], color: 'hsl(var(--warning))' },
        { name: 'Em Atendimento', value: statusCount['in-progress'], color: 'hsl(var(--primary))' },
        { name: 'Reabertos', value: statusCount['reopened'], color: 'hsl(var(--destructive))' },
        { name: 'Aguard. Cliente', value: statusCount['awaiting-customer'], color: '#a855f7' },
        { name: 'Aguard. Terceiro', value: statusCount['awaiting-third-party'], color: '#6366f1' },
      ].filter(item => item.value > 0);
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
};

/**
 * Hook to fetch team workload (for admins/managers)
 */
export const useTeamWorkload = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['team-workload', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase.rpc('get_technician_workload', {
        p_company_id: companyId
      });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });
};
