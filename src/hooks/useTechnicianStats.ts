import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay } from 'date-fns';
import { calculateSlaStatus } from '@/lib/ticket-helpers';

/**
 * Hook para buscar estatísticas pessoais do técnico logado
 */
export const useTechnicianStats = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['technician-stats', userId],
    queryFn: async () => {
      if (!userId) return null;

      const now = new Date();
      const today = startOfDay(now);

      // 1. Em Atendimento (tickets in-progress atribuídos ao técnico)
      const { data: inProgressTickets, error: inProgressError } = await supabase
        .from('tickets')
        .select('id')
        .eq('status', 'in-progress')
        .eq('assigned_to_user_id', userId);

      if (inProgressError) throw inProgressError;

      // 2. Resolvidos Hoje (tickets resolvidos pelo técnico nas últimas 24h)
      const { data: resolvedToday, error: resolvedError } = await supabase
        .from('tickets')
        .select('id')
        .in('status', ['resolved', 'closed'])
        .eq('assigned_to_user_id', userId)
        .gte('resolved_at', today.toISOString());

      if (resolvedError) throw resolvedError;

      // 3. SLA em Risco e Breached
      const { data: activeTickets, error: activeError } = await supabase
        .from('tickets')
        .select('id, sla_due_date, created_at')
        .eq('assigned_to_user_id', userId)
        .not('status', 'in', '("resolved","closed","cancelled")');

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

      // 4. Meus Pendentes (tickets abertos atribuídos ao técnico)
      const { data: pendingTickets, error: pendingError } = await supabase
        .from('tickets')
        .select('id')
        .eq('assigned_to_user_id', userId)
        .in('status', ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party']);

      if (pendingError) throw pendingError;

      return {
        inProgress: inProgressTickets?.length || 0,
        resolvedToday: resolvedToday?.length || 0,
        slaAtRisk: slaAtRiskCount + slaBreachedCount,
        pending: pendingTickets?.length || 0,
      };
    },
    enabled: !!userId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};

/**
 * Hook para buscar distribuição de tickets do técnico por status
 */
export const useTechnicianWorkload = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['technician-workload', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('status')
        .eq('assigned_to_user_id', userId)
        .not('status', 'in', '("resolved","closed","cancelled")');

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
        { name: 'Em Andamento', value: statusCount['in-progress'], color: 'hsl(var(--primary))' },
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
 * Hook para buscar tickets não atribuídos (fila geral)
 */
export const useUnassignedTickets = () => {
  return useQuery({
    queryKey: ['unassigned-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, priority, created_at, category, requester_name')
        .eq('status', 'open')
        .is('assigned_to_user_id', null)
        .order('created_at', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
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
