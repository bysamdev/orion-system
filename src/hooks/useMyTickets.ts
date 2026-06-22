import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { Ticket } from './useTickets';
import { enrichTicketsWithCompany } from '@/lib/ticket-helpers';

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
      
      const now = new Date();
      return enrichedTickets.filter(ticket => {
        if (!ticket.sla_due_date) return false;
        const dueDate = new Date(ticket.sla_due_date);
        
        // Breached
        if (now > dueDate) return true;
        
        if (ticket.created_at) {
          const createdDate = new Date(ticket.created_at);
          const slaPolicyMs = dueDate.getTime() - createdDate.getTime();
          const msRemaining = dueDate.getTime() - now.getTime();
          
          if (slaPolicyMs > 0) {
            const percentualRestante = (msRemaining / slaPolicyMs) * 100;
            // Critical (attention) is <= 15%
            if (percentualRestante <= 15) return true;
          }
        }
        return false;
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
