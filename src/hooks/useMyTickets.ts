import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ticket } from './useTickets';
import { MOCK_TICKETS, getMockTicketsByStatus } from '@/mocks/tickets';

// Teto de segurança pras filas abaixo (ativos/SLA-em-risco/não-atribuídos)
// que não têm controle de página — diferente de useMeusTickets, que já
// pagina de verdade. Essas filas se auto-limitam pelo filtro de status
// (só tickets ainda abertos), mas sem um teto explícito nada impede que
// cresçam sem limite conforme o volume de chamados simultâneos aumenta.
const ACTIVE_QUEUE_SAFETY_LIMIT = 500;

/**
 * Hook para buscar tickets atribuídos ao técnico logado (ativos)
 */
export const useMyActiveTickets = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['my-active-tickets', userId],
    queryFn: async () => {
      if (!userId) return [];

      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(['in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'open', 'reopened']).filter(
          t => t.assigned_to_user_id === userId || !userId || t.assigned_to_user_id === 'test-user'
        ) as unknown as Promise<Ticket[]>;
      }

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('assigned_to_user_id', userId)
        .in('status', ['in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'open', 'reopened'])
        .order('sla_due_date', { ascending: true, nullsFirst: false })
        .limit(ACTIVE_QUEUE_SAFETY_LIMIT);

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
      if (import.meta.env.DEV) {
        return MOCK_TICKETS.filter(ticket => ticket.sla_status === 'warning' || ticket.sla_status === 'attention' || ticket.sla_status === 'breached') as unknown as Ticket[];
      }

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .not('status', 'in', '("resolved","closed","cancelled")')
        .order('sla_due_date', { ascending: true, nullsFirst: false })
        .limit(ACTIVE_QUEUE_SAFETY_LIMIT);

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
 * Hook para buscar tickets não atribuídos (fila geral / fila de espera) - com SLA
 */
export const useUnassignedTicketsEnhanced = () => {
  return useQuery({
    queryKey: ['unassigned-tickets-enhanced'],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(['open', 'reopened', 'awaiting-customer', 'awaiting-third-party']).filter(
          t => !t.assigned_to_user_id && !t.assigned_to
        ) as unknown as Promise<Ticket[]>;
      }

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .is('assigned_to_user_id', null)
        .in('status', ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party'])
        .order('sla_due_date', { ascending: true, nullsFirst: false })
        .limit(ACTIVE_QUEUE_SAFETY_LIMIT);

      if (error) throw error;
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
    },
    refetchInterval: 30000,
    staleTime: 15_000,
  });
};

/**
 * Hook para buscar todos os tickets ativos (visão geral da equipe / admins)
 */
export const useAllActiveTickets = () => {
  return useQuery({
    queryKey: ['all-active-tickets'],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(['open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party']) as unknown as Promise<Ticket[]>;
      }

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .in('status', ['open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party'])
        .order('created_at', { ascending: false })
        .limit(ACTIVE_QUEUE_SAFETY_LIMIT);

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

      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(['closed', 'cancelled']) as unknown as any[];
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, status, category, assigned_to, updated_at, resolved_at, requester_name')
        .eq('assigned_to_user_id', userId)
        .in('status', ['closed', 'cancelled'])
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
      const { data, error } = await supabase.rpc('count_company_active_agents', { 
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

      if (import.meta.env.DEV) {
        let mockData = MOCK_TICKETS;
        
        if (options.statusIn && options.statusIn.length > 0) {
          mockData = mockData.filter(t => options.statusIn?.includes(t.status));
        } else if (options.statusFilter && options.statusFilter !== 'all') {
          if (options.statusFilter === 'open') {
            mockData = mockData.filter(t => ['open', 'reopened'].includes(t.status));
          } else if (options.statusFilter === 'in-progress') {
            mockData = mockData.filter(t => ['in-progress', 'awaiting-customer', 'awaiting-third-party'].includes(t.status));
          } else if (options.statusFilter === 'resolved') {
            mockData = mockData.filter(t => ['resolved', 'closed', 'cancelled'].includes(t.status));
          } else {
            mockData = mockData.filter(t => t.status === options.statusFilter);
          }
        }
        
        if (options.searchTerm) {
          const raw = options.searchTerm.trim().toLowerCase();
          const cleanNum = raw.replace(/^[#nº\s]+/i, '').trim();
          mockData = mockData.filter(t => 
            t.title?.toLowerCase().includes(raw) ||
            t.description?.toLowerCase().includes(raw) ||
            t.requester_name?.toLowerCase().includes(raw) ||
            t.assigned_to?.toLowerCase().includes(raw) ||
            t.category?.toLowerCase().includes(raw) ||
            t.id?.toLowerCase().includes(raw) ||
            t.user_id?.toLowerCase().includes(raw) ||
            String(t.ticket_number) === cleanNum
          );
        }

        return { data: mockData as unknown as Ticket[], count: mockData.length };
      }

      let query = supabase
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
        const rawTerm = options.searchTerm.trim();
        const cleanNumber = rawTerm.replace(/^[#nº\s]+/i, '').trim();
        const isNumeric = /^\d+$/.test(cleanNumber);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTerm);
        const safeTerm = rawTerm.replace(/[%_,()]/g, '');

        if (isUUID) {
          query = query.or(`id.eq.${rawTerm},user_id.eq.${rawTerm},assigned_to_user_id.eq.${rawTerm}`);
        } else if (isNumeric) {
          const num = parseInt(cleanNumber, 10);
          query = query.or(`ticket_number.eq.${num},title.ilike.%${safeTerm}%,requester_name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`);
        } else {
          // Buscas auxiliares por Empresa e Perfil para enriquecer o filtro
          let matchedCompanyIds: string[] = [];
          let matchedUserIds: string[] = [];

          if (safeTerm.length >= 2) {
            try {
              const [{ data: compData }, { data: profData }] = await Promise.all([
                supabase.from('companies').select('id').ilike('name', `%${safeTerm}%`).limit(10),
                supabase.from('profiles').select('id').or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`).limit(15),
              ]);
              if (compData) matchedCompanyIds = compData.map(c => c.id);
              if (profData) matchedUserIds = profData.map(p => p.id);
            } catch (e) {
              console.warn('Erro ao buscar metadados de pesquisa:', e);
            }
          }

          const orConditions = [
            `title.ilike.%${safeTerm}%`,
            `description.ilike.%${safeTerm}%`,
            `requester_name.ilike.%${safeTerm}%`,
            `assigned_to.ilike.%${safeTerm}%`,
            `category.ilike.%${safeTerm}%`,
          ];

          if (matchedCompanyIds.length > 0) {
            orConditions.push(`company_id.in.(${matchedCompanyIds.join(',')})`);
          }
          if (matchedUserIds.length > 0) {
            orConditions.push(`user_id.in.(${matchedUserIds.join(',')})`);
            orConditions.push(`assigned_to_user_id.in.(${matchedUserIds.join(',')})`);
          }

          query = query.or(orConditions.join(','));
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
