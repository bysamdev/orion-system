import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { ticketStatusSchema, ticketPrioritySchema, ticketUpdateSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { enrichTicketsWithCompany, calculateSlaStatus } from '@/lib/ticket-helpers';
import { MOCK_TICKETS, getMockTicketsByStatus } from '@/mocks/tickets';
import { construirFiltroPeriodoRelatorio } from '@/lib/reports/aggregations';

export interface Ticket {
  id: string;
  ticket_number: number;
  user_id?: string | null;
  title: string;
  description: string;
  requester_name: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'awaiting-customer' | 'awaiting-third-party' | 'resolved' | 'closed' | 'reopened' | 'cancelled';
  operator_name: string | null;
  assigned_to: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
  company_name: string | null;
  assigned_to_user_id?: string | null;
  // Campos SLA
  sla_due_date: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_status: 'ok' | 'warning' | 'attention' | 'breached' | null;
  // Campos de Acesso Remoto
  remote_id: string | null;
  remote_password: string | null;
  sla_paused_at: string | null;
  sla_accumulated_pause_minutes: number | null;
  contract_id: string | null;
  asset_id: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  author: string;
  content: string;
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change';
  created_at: string;
  is_internal: boolean;
}

interface DateRangeArgs {
  dateFrom: string;
  dateTo: string;
}

// Teto de segurança, não paginação de UI: esta query não tem controles de
// página (diferente de useMeusTickets em useMyTickets.ts, que já pagina de
// verdade via .range()). Sem isso, uma chamada sem status nem dateRange
// buscaria a tabela tickets inteira. order('created_at', desc) garante que
// o corte mantém os mais recentes.
const TICKET_LIST_SAFETY_LIMIT = 1000;

export const useTickets = (status?: string, dateRange?: DateRangeArgs) => {
  return useQuery({
    queryKey: ['tickets', status, dateRange],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        return getMockTicketsByStatus(status) as unknown as Promise<Ticket[]>;
      }

      // Use read client for queries
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        // Se status for 'open', incluir também 'reopened' e aguardando
        if (status === 'open') {
          query = query.in('status', ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party']);
        } else if (status === 'closed') {
          query = query.in('status', ['closed', 'cancelled']);
        } else {
          query = query.eq('status', status);
        }
      }

      if (dateRange) {
        // Sem isso, Reports.tsx buscava a tabela de tickets inteira da
        // empresa a cada carregamento e só filtrava depois no cliente — não
        // escala conforme o histórico cresce.
        query = query.or(construirFiltroPeriodoRelatorio(dateRange));
      }

      query = query.limit(TICKET_LIST_SAFETY_LIMIT);

      const { data: tickets, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
      
      return enrichTicketsWithCompany(tickets || []) as Promise<Ticket[]>;
    },
    staleTime: 30_000,
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        const mockTicket = MOCK_TICKETS.find(t => t.id === id) || MOCK_TICKETS[0];
        return mockTicket as Ticket;
      }

      console.log('[useTicket] Buscando ticket com id:', id);
      // Busca o ticket com o nome do operador via FK explícita (evita PGRST201)
      // Não usamos join aninhado profiles→companies pois há múltiplas FKs e gera ambiguidade.
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
          *,
          profiles:fk_tickets_user (
            full_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('[useTicket] Erro retornado pelo Supabase:', error.code, error.message, error.details);
        throw error;
      }

      // Busca o nome da empresa separadamente usando o company_id do próprio ticket
      let companyName: string | null = null;
      if (ticket.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', ticket.company_id)
          .maybeSingle();
        companyName = company?.name ?? null;
      }

      // Limpa o objeto aninhado para não poluir o estado
      const { profiles, ...cleanedTicket } = ticket as typeof ticket & { profiles?: unknown };

      const dynamicSlaStatus = ticket.sla_due_date ? calculateSlaStatus(ticket.sla_due_date, ticket.created_at) : ticket.sla_status;
      return { ...cleanedTicket, company_name: companyName, sla_status: dynamicSlaStatus } as Ticket;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
};

export const useTicketUpdates = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-updates', ticketId],
    queryFn: async () => {
      // Fetch updates and associated author profiles in a single query using joins
      const { data: updates, error } = await supabase
        .from('ticket_updates')
        .select(`
          *,
          profiles:author_id (
            full_name
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!updates || updates.length === 0) return [];

      return updates.map(u => {
        // Extract nested profile full_name if available
        let authorName = u.author || 'Sistema';
        if (u.profiles && !Array.isArray(u.profiles)) {
          authorName = (u.profiles as { full_name?: string }).full_name || authorName;
        }

        // Clean up nested objects
        const { profiles, ...cleanedUpdate } = u as typeof u & { profiles?: unknown };

        return {
          ...cleanedUpdate,
          author: authorName
        } as TicketUpdate;
      });
    },
    enabled: !!ticketId,
    staleTime: 60_000,
  });
};

export const invalidateTicketQueries = (queryClient: any, ticketId?: string) => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
  queryClient.invalidateQueries({ queryKey: ['my-active-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
  queryClient.invalidateQueries({ queryKey: ['all-active-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['technician-stats'] });
  queryClient.invalidateQueries({ queryKey: ['my-recent-closed'] });
  queryClient.invalidateQueries({ queryKey: ['sla-at-risk-tickets'] });
  queryClient.invalidateQueries({ queryKey: ['technician-workload'] });
  queryClient.invalidateQueries({ queryKey: ['team-workload'] });
  queryClient.invalidateQueries({ queryKey: ['meus-tickets'] });
  if (ticketId) {
    queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['ticket-updates', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['ticket-status-history', ticketId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['ticket'] });
    queryClient.invalidateQueries({ queryKey: ['ticket-updates'] });
    queryClient.invalidateQueries({ queryKey: ['ticket-status-history'] });
  }
};

// expected_status, assigned_to, assigned_to_user_id, sla_paused_at,
// sla_accumulated_pause_minutes, resolution_notes e previousStatus saíram:
// nenhum chamador passava nenhum deles. O SLA é pausado pelo trigger
// tr_ticket_sla_pause no banco, e previousStatus só servia ao rollback
// compensatório que deixou de existir.
export interface UpdateTicketStatusParams {
  id: string;
  status: string;
  last_updated_at?: string | null;
  updateContent?: string;
  updateType?: 'comment' | 'status_change' | 'assignment' | 'priority_change';
  is_internal?: boolean;
}

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só (alterar_status_chamado, migration 20260911160000).
    // Antes o UPDATE e o INSERT da timeline eram requisições separadas, e a
    // falha da segunda disparava um UPDATE de reversão sem precondição de
    // versão — que apagava a alteração de quem tivesse mexido no chamado no
    // intervalo.
    mutationFn: async ({
      id,
      status,
      last_updated_at,
      updateContent,
      updateType = 'status_change',
      is_internal = false,
    }: UpdateTicketStatusParams) => {
      const validationResult = ticketStatusSchema.safeParse(status);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      const { data, error } = await supabase.rpc('alterar_status_chamado', {
        p_ticket_id: id,
        p_status: validationResult.data,
        p_update_content: updateContent ?? null,
        p_update_type: updateType,
        p_is_internal: is_internal,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      
      if (data.status === 'in-progress' && data.assigned_to) {
        toast({
          title: 'Atendimento iniciado',
          description: `Você foi atribuído ao chamado #${data.ticket_number}`,
        });
      } else {
        toast({
          title: 'Status atualizado',
          description: 'O status do chamado foi atualizado com sucesso.',
        });
      }
    },
    onError: (error: Error) => {
      logError('useUpdateTicketStatus', error);
      toast({
        title: 'Erro de atualização',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface UpdateAssignmentParams {
  id: string;
  assigned_to: string | null;
  assigned_to_user_id?: string | null;
  last_updated_at?: string | null;
  updateContent?: string;
}

export const useUpdateTicketAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só (atribuir_chamado, migration 20260911160000).
    mutationFn: async ({
      id,
      assigned_to,
      assigned_to_user_id,
      last_updated_at,
      updateContent,
    }: UpdateAssignmentParams) => {
      const { data, error } = await supabase.rpc('atribuir_chamado', {
        p_ticket_id: id,
        p_assigned_to: assigned_to,
        p_assigned_to_user_id: assigned_to_user_id ?? null,
        p_update_content: updateContent ?? null,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Técnico atribuído',
        description: 'O técnico foi atribuído ao chamado com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useUpdateTicketAssignment', error);
      toast({
        title: 'Erro ao atribuir técnico',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

// userId saiu: assumir_chamado resolve o responsável por auth.uid(), então
// mandar o id pela rede só criava a chance de divergir de quem realmente está
// autenticado.
export interface AssumeTicketParams {
  id: string;
  userName: string;
  last_updated_at?: string | null;
}

export const useAssumeTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só (assumir_chamado, migration 20260911160000). O id do
    // técnico não vai mais pela rede: a função usa auth.uid(), já que quem
    // assume é sempre quem está chamando.
    mutationFn: async ({
      id,
      userName,
      last_updated_at,
    }: AssumeTicketParams) => {
      const { data, error } = await supabase.rpc('assumir_chamado', {
        p_ticket_id: id,
        p_user_name: userName,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data?.id);
      toast({
        title: 'Chamado Assumido',
        description: `Você assumiu o chamado #${data?.ticket_number || ''} e o status foi alterado para Em Atendimento.`,
      });
    },
    onError: (error: Error) => {
      logError('useAssumeTicket', error);
      toast({
        title: 'Erro ao assumir chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    }
  });
};

export interface UpdatePriorityParams {
  id: string;
  priority: string;
  last_updated_at?: string | null;
  updateContent?: string;
}

export const useUpdateTicketPriority = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só (alterar_prioridade_chamado, migration 20260911160000).
    mutationFn: async ({
      id,
      priority,
      last_updated_at,
      updateContent,
    }: UpdatePriorityParams) => {
      const validated = ticketPrioritySchema.safeParse(priority);
      if (!validated.success) {
        throw new Error(validated.error.errors[0].message);
      }

      const { data, error } = await supabase.rpc('alterar_prioridade_chamado', {
        p_ticket_id: id,
        p_priority: validated.data,
        p_update_content: updateContent ?? null,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Prioridade alterada',
        description: 'A prioridade do chamado foi atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useUpdateTicketPriority', error);
      toast({
        title: 'Erro ao alterar prioridade',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export interface ResolveTicketParams {
  id: string;
  notes: string;
  resolutionContent: string;
  last_updated_at?: string | null;
}

export const useResolveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só, no banco (resolver_chamado, migration
    // 20260911150000). Antes eram duas requisições: atualizava o ticket,
    // depois inseria a timeline, e se a segunda falhasse o cliente tentava
    // desfazer a primeira com um UPDATE sem precondição de versão — que
    // sobrescrevia a alteração de qualquer técnico que tivesse mexido no
    // chamado nesse intervalo. Agora ou as duas escritas valem, ou nenhuma,
    // e não há mais nada para compensar.
    mutationFn: async ({
      id,
      notes,
      resolutionContent,
      last_updated_at,
    }: ResolveTicketParams) => {
      const { data, error } = await supabase.rpc('resolver_chamado', {
        p_ticket_id: id,
        p_notes: notes,
        p_resolution_content: resolutionContent,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        // 40001 é levantado pela função quando updated_at não bate com a
        // versão que esta aba carregou; 42501 quando o chamado não existe
        // ou a RLS não deixa este usuário resolvê-lo.
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.id);
      toast({
        title: 'Chamado Resolvido',
        description: 'O chamado foi resolvido com sucesso.',
      });
    },
    onError: (error: Error) => {
      logError('useResolveTicket', error);
      toast({
        title: 'Erro ao resolver chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

// currentPriority/currentAssignedTo/currentAssignedToUserId saíram: quem
// decide o que mudou é escalar_chamado, comparando com a linha travada por
// FOR UPDATE. Os valores da tela podiam estar defasados.
export interface EscalateTicketParams {
  id: string;
  technicianName: string;
  technicianUserId?: string | null;
  newPriority: string;
  reason: string;
  last_updated_at?: string | null;
}

export const useEscalateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Uma transação só (escalar_chamado, migration 20260911160000). O que
    // mudou passa a ser decidido no banco, comparando com a linha travada por
    // FOR UPDATE, e não pelos valores currentPriority/currentAssignedTo que a
    // tela enviava — aqueles podiam estar defasados e fazer a timeline
    // descrever uma transição que não aconteceu.
    mutationFn: async ({
      id,
      technicianName,
      technicianUserId,
      newPriority,
      reason,
      last_updated_at,
    }: EscalateTicketParams) => {
      const { data, error } = await supabase.rpc('escalar_chamado', {
        p_ticket_id: id,
        p_technician_name: technicianName,
        p_technician_user_id: technicianUserId ?? null,
        p_new_priority: newPriority,
        p_reason: reason,
        p_expected_updated_at: last_updated_at ?? null,
      });

      if (error) {
        if (error.code === '40001') {
          throw new Error('Conflito de concorrência: O chamado foi modificado por outro técnico. Por favor, recarregue a página.');
        }
        throw error;
      }

      return data as unknown as Ticket;
    },
    onSuccess: (data, variables) => {
      const ticketId = data?.id || variables.id;
      invalidateTicketQueries(queryClient, ticketId);
      toast({
        title: 'Chamado Escalado',
        description: 'O chamado foi escalado com sucesso e o histórico registrado.',
      });
    },
    onError: (error: Error) => {
      logError('useEscalateTicket', error);
      toast({
        title: 'Erro ao escalar chamado',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
      invalidateTicketQueries(queryClient);
    },
  });
};

export const useAddTicketUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (update: { ticket_id: string; content: string; type: string; is_internal?: boolean }) => {
      const validationResult = ticketUpdateSchema.safeParse(update);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const validData = validationResult.data;
      const { data, error } = await supabase
        .from('ticket_updates')
        .insert([{ 
          ticket_id: validData.ticket_id,
          content: validData.content,
          type: validData.type,
          author: '',
          author_id: user.id,
          is_internal: update.is_internal || false
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateTicketQueries(queryClient, data.ticket_id);
      toast({
        title: 'Comentário adicionado',
        description: 'Seu comentário foi adicionado com sucesso.',
      });
    },
    onError: (error) => {
      logError('useAddTicketUpdate', error);
      toast({
        title: 'Erro',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
    },
  });
};
