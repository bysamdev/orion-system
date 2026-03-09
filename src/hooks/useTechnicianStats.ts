import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subHours } from 'date-fns';

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
      const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      // Buscar perfil do técnico para pegar o nome
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      const technicianName = profile?.full_name || '';

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

      // 3. SLA em Risco (tickets do técnico com prazo < 4 horas)
      const { data: slaAtRisk, error: slaError } = await supabase
        .from('tickets')
        .select('id')
        .eq('assigned_to_user_id', userId)
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_due_date', fourHoursFromNow.toISOString())
        .gt('sla_due_date', now.toISOString());

      if (slaError) throw slaError;

      // 3b. SLA Breached (já passou do prazo)
      const { data: slaBreached, error: slaBreachedError } = await supabase
        .from('tickets')
        .select('id')
        .eq('assigned_to_user_id', userId)
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_due_date', now.toISOString());

      if (slaBreachedError) throw slaBreachedError;

      // 4. Meus Pendentes (tickets abertos atribuídos ao técnico)
      const { data: pendingTickets, error: pendingError } = await supabase
        .from('tickets')
        .select('id')
        .eq('assigned_to_user_id', userId)
        .in('status', ['open', 'reopened']);

      if (pendingError) throw pendingError;

      return {
        inProgress: inProgressTickets?.length || 0,
        resolvedToday: resolvedToday?.length || 0,
        slaAtRisk: (slaAtRisk?.length || 0) + (slaBreached?.length || 0),
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
        .not('status', 'in', '("resolved","closed")');

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
