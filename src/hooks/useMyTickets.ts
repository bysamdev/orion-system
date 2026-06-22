import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { Ticket } from './useTickets';

/**
 * Hook para buscar tickets atribuídos ao técnico logado (ativos)
 */
export const useMyActiveTickets = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['my-active-tickets', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: tickets, error } = await supabaseRead
        .from('tickets')
        .select('*')
        .eq('assigned_to_user_id', userId)
        .in('status', ['open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party'])
        .order('sla_due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
    },
    enabled: !!userId,
    refetchInterval: 30000,
    staleTime: 15_000,
  });
};

/**
 * Hook para buscar tickets com SLA em risco de toda a equipe
 */
export const useSLAAtRiskTickets = () => {
  return useQuery({
    queryKey: ['sla-at-risk-tickets'],
    queryFn: async () => {
      const { data: tickets, error } = await supabaseRead
        .from('tickets')
        .select('*')
        .not('status', 'in', '("resolved","closed","cancelled")')
        .order('sla_due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      
      const enrichedTickets = await enrichTicketsWithCompany(tickets || []) as Ticket[];
      
      return enrichedTickets.filter(ticket => {
        if (!ticket.sla_due_date) return false;
        const status = calculateSlaStatus(ticket.sla_due_date, ticket.created_at);
        return status === 'warning' || status === 'attention' || status === 'breached';
      });
    },
    refetchInterval: 30000,
    staleTime: 15_000,
  });
};

/**
 * Hook para buscar tickets não atribuídos (fila geral) - com SLA
 */
export const useUnassignedTicketsEnhanced = () => {
  return useQuery({
    queryKey: ['unassigned-tickets-enhanced'],
    queryFn: async () => {
      const { data: tickets, error } = await supabaseRead
        .from('tickets')
        .select('*')
        .in('status', ['open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party'])
        .is('assigned_to_user_id', null)
        .order('sla_due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
    },
    refetchInterval: 30000,
    staleTime: 15_000,
  });
};

/**
 * Hook para buscar tickets fechados recentes do técnico
 */
export const useMyRecentClosedTickets = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['my-recent-closed', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabaseRead
        .from('tickets')
        .select('id, ticket_number, title, status, category, assigned_to, updated_at, resolved_at, requester_name')
        .eq('assigned_to_user_id', userId)
        .in('status', ['resolved', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });
};

/**
 * Hook para buscar a contagem de agentes ativos na empresa para distribuição de chamados
 */
export const useActiveAgentsCount = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['active-agents-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      // @ts-expect-error - RPC not yet in generated types
      const { data, error } = await supabaseRead.rpc('count_company_active_agents', { 
        p_company_id: companyId 
      });

      if (error) {
        console.error('Erro ao buscar contagem de agentes:', error);
        return 0;
      }
      
      return data || 0;
    },
    enabled: !!companyId,
    refetchInterval: 60000,
  });
};

interface UseMeusTicketsOptions {
  role?: string;
  statusFilter?: string;
  statusIn?: string[];
  priorityFilter?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export const useMeusTickets = (userId: string | undefined, role: string | undefined, options: UseMeusTicketsOptions = {}) => {
  return useQuery({
    queryKey: ['meus-tickets', userId, role, options],
    queryFn: async () => {
      if (role === 'customer' && !userId) return { data: [], count: 0 };

      let query = supabaseRead
        .from('tickets')
        .select('*', options.page !== undefined ? { count: 'exact' } : undefined);

      if (role === 'customer' && userId) {
        query = query.eq('user_id', userId);
      }

      if (options.statusIn && options.statusIn.length > 0) {
        query = query.in('status', options.statusIn);
      } else if (options.statusFilter && options.statusFilter !== 'all') {
        if (options.statusFilter === 'open') {
          query = query.in('status', ['open', 'reopened']);
        } else if (options.statusFilter === 'in-progress') {
          query = query.in('status', ['in-progress', 'awaiting-customer', 'awaiting-third-party']);
        } else if (options.statusFilter === 'resolved') {
          query = query.in('status', ['resolved', 'closed', 'cancelled']);
        } else {
          query = query.eq('status', options.statusFilter);
        }
      }

      if (options.priorityFilter && options.priorityFilter !== 'all') {
        query = query.eq('priority', options.priorityFilter);
      }

      if (options.searchTerm) {
        const isNumeric = !isNaN(Number(options.searchTerm)) && options.searchTerm.trim() !== '';
        if (isNumeric) {
          query = query.or(`title.ilike.%${options.searchTerm}%,ticket_number.eq.${Number(options.searchTerm)},requester_name.ilike.%${options.searchTerm}%`);
        } else {
          query = query.or(`title.ilike.%${options.searchTerm}%,requester_name.ilike.%${options.searchTerm}%`);
        }
      }

      query = query.order('created_at', { ascending: false });

      if (options.page !== undefined && options.pageSize !== undefined) {
        query = query
          .order('id', { ascending: true }) // Tie-breaker for stable pagination
          .range(options.page * options.pageSize, (options.page + 1) * options.pageSize - 1);
      } else if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const enrichedData = await enrichTicketsWithCompany(data || []);

      return { data: enrichedData, count: count || 0 };
    },
    enabled: role !== 'customer' || !!userId,
  });
};
