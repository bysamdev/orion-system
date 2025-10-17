import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, endOfDay, endOfWeek } from 'date-fns';

export const useActiveOperators = () => {
  return useQuery({
    queryKey: ['active-operators'],
    queryFn: async () => {
      const { data, error } = await supabase
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

      // Get tickets created in the period
      const { data: createdTickets, error: createdError } = await supabase
        .from('tickets')
        .select('id, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (createdError) throw createdError;

      // Get tickets resolved/closed in the period
      const { data: solvedTickets, error: solvedError } = await supabase
        .from('tickets')
        .select('id, updated_at, created_at')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', startDate.toISOString())
        .lte('updated_at', endDate.toISOString());

      if (solvedError) throw solvedError;

      // Calculate average response time for solved tickets
      let avgHours = 0;
      if (solvedTickets && solvedTickets.length > 0) {
        const totalHours = solvedTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgHours = totalHours / solvedTickets.length;
      }

      return {
        opened: createdTickets?.length || 0,
        solved: solvedTickets?.length || 0,
        averageHours: avgHours,
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

      // In progress tickets
      const { data: inProgressTickets, error: inProgressError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'in-progress');

      if (inProgressError) throw inProgressError;

      // Tickets resolved today
      const { data: resolvedToday, error: resolvedTodayError } = await supabase
        .from('tickets')
        .select('id, created_at, updated_at')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', today.toISOString());

      if (resolvedTodayError) throw resolvedTodayError;

      // Calculate SLA compliance (assuming 4 hours as target)
      const slaTarget = 4; // hours
      let slaCompliance = 0;
      if (resolvedToday && resolvedToday.length > 0) {
        const withinSLA = resolvedToday.filter(ticket => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          return hours <= slaTarget;
        }).length;
        slaCompliance = (withinSLA / resolvedToday.length) * 100;
      }

      // Open tickets
      const { data: openTickets, error: openError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'open');

      if (openError) throw openError;

      // Tickets opened today
      const { data: openedToday, error: openedTodayError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      if (openedTodayError) throw openedTodayError;

      // Average response time (all tickets)
      const { data: allTickets, error: allTicketsError } = await supabase
        .from('tickets')
        .select('created_at, updated_at, status')
        .in('status', ['resolved', 'closed', 'in-progress']);

      if (allTicketsError) throw allTicketsError;

      let avgResponseTime = 0;
      let slaOverall = 0;
      if (allTickets && allTickets.length > 0) {
        const totalHours = allTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgResponseTime = totalHours / allTickets.length;

        // Calculate overall SLA
        const withinSLA = allTickets.filter(ticket => {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          return hours <= slaTarget;
        }).length;
        slaOverall = (withinSLA / allTickets.length) * 100;
      }

      return {
        inProgress: inProgressTickets?.length || 0,
        resolvedToday: resolvedToday?.length || 0,
        slaComplianceToday: Math.round(slaCompliance),
        openTickets: openTickets?.length || 0,
        openedToday: openedToday?.length || 0,
        avgResponseTime,
        slaOverall: Math.round(slaOverall),
      };
    },
  });
};
