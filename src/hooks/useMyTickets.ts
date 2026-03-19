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
        .in('sla_status', ['attention', 'breached'])
        .not('status', 'in', '("resolved","closed","cancelled")')
        .order('sla_due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
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
        .eq('status', 'open')
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
