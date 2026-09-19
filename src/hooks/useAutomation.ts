import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// automation_logs ainda não está nos tipos gerados do Supabase; esta visão
// sem esquema evita espalhar `any` pelo arquivo.
const semEsquema = supabase as unknown as SupabaseClient;

// Automações são área de gestor. Quem pode ver o quê é decidido pela RLS
// (pode_gerir_automacao, migration 20260919040000): gestor da empresa-mãe e
// desenvolvedor veem todas as empresas; gestor de empresa cliente, só a
// própria. Por isso nenhuma consulta aqui filtra por empresa: o que a RLS
// devolve é exatamente o que a pessoa pode gerir. O filtro de empresa da tela
// é só de visualização.

export interface Condicao {
  field: string;
  operator: string;
  value: string;
}

export interface Acao {
  type: string;
  target: string;
}

export interface RoutingRule {
  id: string;
  company_id: string | null;
  name: string;
  description?: string | null;
  priority: number;
  // O motor aceita um objeto (formato antigo) ou uma lista.
  conditions: Condicao | Condicao[];
  actions: Acao | Acao[];
  is_active: boolean;
  created_at?: string;
  companies?: { name: string } | null;
}

export interface AutomationLog {
  id: string;
  rule_id: string | null;
  ticket_id: string | null;
  rule_name: string | null;
  action_type: string;
  action_result: string | null;
  created_at: string;
  tickets?: { ticket_number: number; title: string; company_id: string | null } | null;
}

export interface CannedResponseFull {
  id: string;
  title: string;
  content: string;
  shortcut?: string | null;
  company_id: string | null;
  companies?: { name: string } | null;
}

export interface CannedResponseRef {
  id: string;
  title: string;
  shortcut?: string | null;
  company_id?: string | null;
}

export interface Company {
  id: string;
  name: string;
}

export const listaDeCondicoes = (c: RoutingRule['conditions'] | null | undefined): Condicao[] =>
  Array.isArray(c) ? c : c && typeof c === 'object' && 'field' in c ? [c] : [];

export const listaDeAcoes = (a: RoutingRule['actions'] | null | undefined): Acao[] =>
  Array.isArray(a) ? a : a && typeof a === 'object' && 'type' in a ? [a] : [];

// Campos que o motor sabe ler (regra_casa_com_chamado).
export const CONDITION_FIELDS = [
  { value: 'category', label: 'Categoria' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'title', label: 'Assunto' },
  { value: 'department', label: 'Departamento' },
  { value: 'company_id', label: 'Empresa' },
];

export const OPERADORES = [
  { value: 'equals', label: 'é igual a' },
  { value: 'not_equals', label: 'é diferente de' },
  { value: 'contains', label: 'contém' },
];

// Ações que o motor executa (tr_auto_route_ticket e tr_automacoes_pos_abertura).
export const ACTION_TYPES = [
  { value: 'assign_tech', label: 'Atribuir a um técnico', precisaAlvo: true },
  { value: 'round_robin', label: 'Distribuir pela fila (menos ocupado)', precisaAlvo: false },
  { value: 'escalate_manager', label: 'Escalar para gestor', precisaAlvo: true },
  { value: 'set_priority', label: 'Mudar a prioridade', precisaAlvo: true },
  { value: 'auto_response', label: 'Enviar resposta automática', precisaAlvo: true },
  { value: 'notify_all', label: 'Notificar toda a equipe', precisaAlvo: false },
];

export const useRoutingRules = () =>
  useQuery<RoutingRule[]>({
    queryKey: ['routing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routing_rules')
        .select('*, companies(name)')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as RoutingRule[]) || [];
    },
  });

export const useCannedResponseRefs = () =>
  useQuery<CannedResponseRef[]>({
    queryKey: ['canned-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('id, title, shortcut, company_id')
        .order('title');
      if (error) throw error;
      return (data as CannedResponseRef[]) || [];
    },
  });

export const useCannedResponses = () =>
  useQuery<CannedResponseFull[]>({
    queryKey: ['canned-responses-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('*, companies(name)')
        .order('title');
      if (error) throw error;
      return (data as unknown as CannedResponseFull[]) || [];
    },
  });

export const useAutomationLogs = () =>
  useQuery<AutomationLog[]>({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await semEsquema
        .from('automation_logs')
        .select('*, tickets(ticket_number, title, company_id)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data as unknown as AutomationLog[]) || [];
    },
    refetchInterval: 15_000,
  });

export interface RegraParaSalvar {
  id?: string;
  company_id: string;
  name: string;
  description: string;
  priority: number;
  conditions: Condicao[];
  actions: Acao[];
  is_active: boolean;
}

export const useSaveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conditions, actions, ...resto }: RegraParaSalvar) => {
      const payload = { ...resto, conditions: conditions as unknown as Json, actions: actions as unknown as Json };
      const { error } = id
        ? await supabase.from('routing_rules').update(payload).eq('id', id)
        : await supabase.from('routing_rules').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
};

export const useDeleteRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
};

export const useToggleRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('routing_rules').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });
};

export const useSaveCannedResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id?: string; title: string; content: string; shortcut?: string; company_id: string }) => {
      const payload = {
        title: data.title.trim(),
        content: data.content.trim(),
        shortcut: data.shortcut?.trim() || null,
        company_id: data.company_id,
      };
      if (data.id) {
        const { error } = await supabase.from('canned_responses').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('canned_responses').insert([{ ...payload, created_by: user?.id ?? '' }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses-full'] });
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
    },
  });
};

export const useDeleteCannedResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('canned_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses-full'] });
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
    },
  });
};
