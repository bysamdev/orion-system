import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { startOfDay, startOfWeek, endOfDay, endOfWeek, subDays, format } from 'date-fns';

// SLA targets by priority (in hours)
export const SLA_TARGETS = {
  high: 2,
  medium: 4,
  low: 8,
} as const;

export const useActiveOperators = () => {
  return useQuery({
    queryKey: ['active-operators'],
    queryFn: async () => {
      // Use read client for statistics queries
      const { data, error } = await supabaseRead
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['technician', 'admin']);

      if (error) throw error;
      
      // Count unique users (someone could have multiple roles)
      const uniqueOperators = new Set(data?.map(r => r.user_id) || []);
      return uniqueOperators.size;
    },
  });
};

export const useTicketStats = (period: 'daily' | 'weekly') => {
  return useQuery({
    queryKey: ['ticket-stats', period],
    queryFn: async () => {
      const now = new Date();
      const startDate = period === 'daily' ? startOfDay(now) : startOfWeek(now, { weekStartsOn: 0 });
      const endDate = period === 'daily' ? endOfDay(now) : endOfWeek(now, { weekStartsOn: 0 });

      // Get tickets created in the period (using read client)
      const { data: createdTickets, error: createdError } = await supabaseRead
        .from('tickets')
        .select('id, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (createdError) throw createdError;

      // Get tickets resolved/closed in the period (using read client)
      const { data: solvedTickets, error: solvedError } = await supabaseRead
        .from('tickets')
        .select('id, updated_at, created_at')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', startDate.toISOString())
        .lte('updated_at', endDate.toISOString());

      if (solvedError) throw solvedError;

      // Get full ticket data for SLA calculation
      const { data: solvedTicketsWithPriority, error: solvedFullError } = await supabaseRead
        .from('tickets')
        .select('id, updated_at, created_at, priority')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', startDate.toISOString())
        .lte('updated_at', endDate.toISOString());

      if (solvedFullError) throw solvedFullError;

      // Calculate average response time and SLA compliance for solved tickets
      let avgHours = 0;
      let slaCompliance = 0;
      if (solvedTicketsWithPriority && solvedTicketsWithPriority.length > 0) {
        let withinSLA = 0;
        const totalHours = solvedTicketsWithPriority.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          
          // Check SLA based on priority
          const slaTarget = SLA_TARGETS[ticket.priority as keyof typeof SLA_TARGETS] || SLA_TARGETS.medium;
          if (hours <= slaTarget) {
            withinSLA++;
          }
          
          return sum + hours;
        }, 0);
        avgHours = totalHours / solvedTicketsWithPriority.length;
        slaCompliance = Math.round((withinSLA / solvedTicketsWithPriority.length) * 100);
      }

      return {
        opened: createdTickets?.length || 0,
        solved: solvedTicketsWithPriority?.length || 0,
        averageHours: avgHours,
        slaCompliance,
      };
    },
  });
};

export const useGlobalTicketStats = () => {
  return useQuery({
    queryKey: ['global-ticket-stats'],
    queryFn: async () => {
      const now = new Date();
      const today = startOfDay(now);

      // In progress tickets (using read client)
      const { data: inProgressTickets, error: inProgressError } = await supabaseRead
        .from('tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'in-progress');

      if (inProgressError) throw inProgressError;

      // Tickets resolved today (using read client)
      const { data: resolvedToday, error: resolvedTodayError } = await supabaseRead
        .from('tickets')
        .select('id, created_at, updated_at')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', today.toISOString());

      if (resolvedTodayError) throw resolvedTodayError;

      // Get full data for SLA calculation with priority
      const { data: resolvedTodayFull, error: resolvedTodayFullError } = await supabaseRead
        .from('tickets')
        .select('id, created_at, updated_at, priority')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', today.toISOString());

      if (resolvedTodayFullError) throw resolvedTodayFullError;

      // Calculate SLA compliance based on priority
      let slaCompliance = 0;
      if (resolvedTodayFull && resolvedTodayFull.length > 0) {
        const withinSLA = resolvedTodayFull.filter(ticket => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          const slaTarget = SLA_TARGETS[ticket.priority as keyof typeof SLA_TARGETS] || SLA_TARGETS.medium;
          return hours <= slaTarget;
        }).length;
        slaCompliance = (withinSLA / resolvedTodayFull.length) * 100;
      }

      // Open tickets (using read client)
      const { data: openTickets, error: openError } = await supabaseRead
        .from('tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'open');

      if (openError) throw openError;

      // Tickets opened today (using read client)
      const { data: openedToday, error: openedTodayError } = await supabaseRead
        .from('tickets')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      if (openedTodayError) throw openedTodayError;

      // Average response time - usando first_response_at para cálculo correto
      const { data: allTickets, error: allTicketsError } = await supabaseRead
        .from('tickets')
        .select('created_at, first_response_at, resolved_at, status, priority')
        .in('status', ['resolved', 'closed', 'in-progress']);

      if (allTicketsError) throw allTicketsError;

      let avgResponseTime = 0;
      let slaOverall = 0;
      if (allTickets && allTickets.length > 0) {
        // Filtrar apenas tickets que têm first_response_at para calcular tempo médio de resposta
        const ticketsWithResponse = allTickets.filter(t => t.first_response_at !== null);
        
        if (ticketsWithResponse.length > 0) {
          const totalHours = ticketsWithResponse.reduce((sum, ticket) => {
            const created = new Date(ticket.created_at);
            const firstResponse = new Date(ticket.first_response_at!);
            const hours = (firstResponse.getTime() - created.getTime()) / (1000 * 60 * 60);
            return sum + Math.max(0, hours); // Garantir que não seja negativo
          }, 0);
          avgResponseTime = totalHours / ticketsWithResponse.length;
        }

        // Calculate overall SLA com base em first_response_at
        const ticketsForSLA = allTickets.filter(t => t.first_response_at !== null);
        if (ticketsForSLA.length > 0) {
          const withinSLA = ticketsForSLA.filter(ticket => {
            const created = new Date(ticket.created_at);
            const firstResponse = new Date(ticket.first_response_at!);
            const hours = (firstResponse.getTime() - created.getTime()) / (1000 * 60 * 60);
            const slaTarget = SLA_TARGETS[ticket.priority as keyof typeof SLA_TARGETS] || SLA_TARGETS.medium;
            return hours <= slaTarget;
          }).length;
          slaOverall = (withinSLA / ticketsForSLA.length) * 100;
        }
      }

      return {
        inProgress: inProgressTickets?.length || 0,
        resolvedToday: resolvedTodayFull?.length || 0,
        slaComplianceToday: Math.round(slaCompliance),
        openTickets: openTickets?.length || 0,
        openedToday: openedToday?.length || 0,
        avgResponseTime,
        slaOverall: Math.round(slaOverall),
      };
    },
  });
};
