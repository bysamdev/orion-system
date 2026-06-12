import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';

// ── Types ─────────────────────────────────────────────────────
export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: { field: string; operator: string; value: string };
  actions: { type: string; target: string };
  is_active: boolean;
}

export interface AutomationLog {
  id: string;
  rule_id: string | null;
  ticket_id: string;
  rule_name: string;
  action_type: string;
  action_result: string;
  created_at: string;
}

export interface CannedResponseFull {
  id: string;
  title: string;
  content: string;
  shortcut?: string;
}

export interface CannedResponseRef {
  id: string;
  title: string;
  shortcut?: string;
}

export interface Technician {
  id: string;
  full_name: string;
}

export interface Company {
  id: string;
  name: string;
  is_vip: boolean;
}

// ── Constants (shared with UI components) ────────────────────
export const CONDITION_FIELDS = [
  { value: 'category', label: 'Categoria' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'title', label: 'Assunto (contém)' },
  { value: 'company_id', label: 'Empresa' },
  { value: 'is_vip', label: '👑 Cliente VIP' },
];

export const ACTION_TYPES = [
  { value: 'assign_tech', label: 'Atribuir a Agente' },
  { value: 'round_robin', label: 'Round-Robin (Fila)' },
  { value: 'escalate_manager', label: 'Escalar para Gestor' },
  { value: 'set_priority', label: 'Definir Prioridade' },
  { value: 'auto_response', label: 'Resposta Automática' },
  { value: 'notify_all', label: 'Notificar Todos os Técnicos' },
];

// ── Hooks ─────────────────────────────────────────────────────

export const useRoutingRules = (companyId: string) =>
  useQuery<RoutingRule[]>({
    queryKey: ['routing-rules', companyId],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('routing_rules')
        .select('*')
        .eq('company_id', companyId)
        .order('priority', { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

export const useTechnicians = (companyId: string) =>
  useQuery<Technician[]>({
    queryKey: ['technicians', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_roles!inner(role)')
        .eq('company_id', companyId)
        .in('user_roles.role', ['technician', 'admin', 'developer']);
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

export const useAllCompanies = () =>
  useQuery<Company[]>({
    queryKey: ['all-companies'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name, is_vip');
      return (data as any[]) || [];
    },
  });

export const useCannedResponseRefs = (companyId: string) =>
  useQuery<CannedResponseRef[]>({
    queryKey: ['canned-responses', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('canned_responses')
        .select('id, title, shortcut')
        .eq('company_id', companyId);
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

export const useCannedResponses = (companyId: string) =>
  useQuery<CannedResponseFull[]>({
    queryKey: ['canned-responses-full', companyId],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('canned_responses')
        .select('*')
        .eq('company_id', companyId)
        .order('title');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

export const useAutomationLogs = () =>
  useQuery<AutomationLog[]>({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await (supabaseRead as any)
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
    refetchInterval: 15_000,
  });

export const useSaveRule = (companyId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RoutingRule> & { id?: string }) => {
      const payload = {
        company_id: companyId,
        name: data.name,
        description: data.description,
        priority: data.priority,
        conditions: data.conditions,
        actions: data.actions,
        is_active: data.is_active,
      };
      if (data.id) {
        const { error } = await supabase.from('routing_rules').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('routing_rules').insert([payload]);
        if (error) throw error;
      }
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

export const useSaveCannedResponse = (companyId: string) => {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['canned-responses-full'] });
    qc.invalidateQueries({ queryKey: ['canned-responses'] });
  };
  return useMutation({
    mutationFn: async (data: { id?: string; title: string; content: string; shortcut?: string }) => {
      const payload: any = {
        title: data.title.trim(),
        content: data.content.trim(),
        shortcut: data.shortcut?.trim() || null,
        company_id: companyId,
      };
      if (data.id) {
        const { error } = await supabase.from('canned_responses').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('canned_responses').insert([{ ...payload, created_by: user?.id }]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
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
