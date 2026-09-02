import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

// Falls back to empty string → relative URL /api/monitoring/... (same Vercel domain)
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

async function apiGet<T>(path: string): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeoutMs: 15000,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// ─── Compliance & Telemetry Types ─────────────────────────
export interface AntivirusInfo {
  name: string;
  active: boolean;
  updated: boolean;
}

export interface SecurityInfo {
  antivirus?: AntivirusInfo[];
  firewall_active?: boolean;
  bitlocker_active?: boolean;
}

export interface RemoteSoftwareInfo {
  name: string;
  version?: string;
  is_running?: boolean;
}

// Campos espelham exatamente o JSON que o agente envia (collector/hardware.go
// BatteryInfo) — o backend repassa isso puro via json.RawMessage, sem
// re-tipar nada, então os nomes aqui têm que bater com os do agente
// byte-a-byte. Já teve divergência real aqui (percentage/is_plugged vs.
// percent/plugged_in), e como os campos são opcionais, TypeScript não
// acusa erro nenhum — só o valor cai sempre no fallback (0%/false).
export interface BatteryInfo {
  has_battery: boolean;
  percent?: number;
  plugged_in?: boolean;
  status?: string;
}

export interface UpdateStatusInfo {
  reboot_required?: boolean;
  pending_count?: number;
}

// ─── Types ───────────────────────────────────────────────
export interface MachineGroup {
  id: string;
  name: string;
  description: string | null;
  client_contact: string | null;
  company_id: string | null;
  total_machines: number;
  online_machines: number;
  alert_machines?: number;
}

// Máquina que mandou heartbeat mas ainda não foi aprovada por um
// admin/técnico (ver migration add_machine_approval_gate). Não carrega
// métricas/hardware — só o suficiente pra decidir aprovar ou rejeitar.
export interface PendingMachine {
  id: string;
  hostname: string;
  ip_address: string | null;
  os: string | null;
  domain: string | null;
  current_user: string | null;
  agent_version: string | null;
  created_at: string;
}

export interface MachineWithMetric {
  id: string;
  group_id: string | null;
  company_id: string | null;
  hostname: string;
  ip_address: string | null;
  mac_address?: string | null;
  domain?: string | null;
  current_user?: string | null;
  os: string | null;
  os_version: string | null;
  status: 'online' | 'offline' | string;
  last_seen: string | null;
  agent_version: string | null;
  created_at: string;
  device_type?: 'desktop' | 'notebook' | 'server' | 'unknown' | string | null;
  device_type_reason?: string | null;
  device_type_locked?: boolean;
  // last metric
  cpu_usage: number | null;
  ram_total: number | null;
  ram_used: number | null;
  disk_total: number | null;
  disk_used: number | null;
  uptime: number | null;
  collected_at: string | null;
  // Endpoint Security, Remote Software, Battery, and Update status
  security_info?: SecurityInfo;
  remote_software?: RemoteSoftwareInfo[];
  battery_info?: BatteryInfo;
  update_status?: UpdateStatusInfo;
}

export interface MetricRow {
  id: string;
  machine_id: string;
  cpu_usage: number | null;
  ram_total: number | null;
  ram_used: number | null;
  disk_total: number | null;
  disk_used: number | null;
  uptime: number | null;
  collected_at: string;
}

export interface AlertRow {
  id: string;
  machine_id: string;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface HardwareRow {
  id: string;
  machine_id: string;
  cpu_model: string | null;
  ram_slots: any;
  disks: any;
  network_interfaces: any;
  gpu: string | null;
  updated_at: string;
  // Endpoint Security, Remote Software, Battery, and Update status
  security_info?: SecurityInfo;
  remote_software?: RemoteSoftwareInfo[];
  battery_info?: BatteryInfo;
  update_status?: UpdateStatusInfo;
}

export interface CommandRow {
  id: string;
  machine_id: string;
  command: string;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  output: string | null;
  executed_by_user_id: string | null;
  executed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineDetail {
  machine: MachineWithMetric;
  hardware: HardwareRow | null;
}

export interface DashboardSummary {
  total: number;
  online: number;
  offline: number;
  active_alerts: number;
  latest_agent_version?: string;
}

// Fallback de segurança pras queries de monitoramento que já são
// invalidadas por useRealtimeMachines a cada heartbeat (INSERT/UPDATE em
// machines dispara invalidateQueries(['monitoring']) — ver
// src/hooks/useRealtimeMachines.ts). Com refetchInterval igual ao dos
// heartbeats (30s), Realtime + polling faziam o mesmo fetch duas vezes por
// ciclo. Mantido em 2min só pra cobrir o caso do canal Realtime cair
// silenciosamente (CHANNEL_ERROR) — não é mais o mecanismo primário.
const FALLBACK_REFETCH_MONITORING = 120_000;

// ─── Hooks ───────────────────────────────────────────────
export function useMonitoringDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => apiGet('/api/monitoring/dashboard'),
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

export function useMonitoringGroups() {
  return useQuery<MachineGroup[]>({
    queryKey: ['monitoring', 'groups'],
    queryFn: () => apiGet('/api/monitoring/groups'),
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

export function usePendingMachines() {
  return useQuery<PendingMachine[]>({
    queryKey: ['monitoring', 'pending-machines'],
    queryFn: () => apiGet('/api/monitoring/machines/pending'),
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

export function useApproveMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (machineId: string) =>
      apiPost<{ success: boolean }>(`/api/monitoring/machines/${machineId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

export function useRejectMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (machineId: string) =>
      apiPost<{ success: boolean }>(`/api/monitoring/machines/${machineId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'pending-machines'] });
    },
  });
}

export function useGroupMachines(groupId: string | null) {
  return useQuery<MachineWithMetric[]>({
    queryKey: ['monitoring', 'group-machines', groupId],
    queryFn: () => apiGet(`/api/monitoring/groups/${groupId}/machines`),
    enabled: !!groupId,
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

// Antes fazia 1 request HTTP por grupo (Promise.all(groups.map(...))) — N
// requests em paralelo pra montar uma lista que /api/monitoring/machines
// já devolve pronta num único round-trip.
export function useAllMachines() {
  return useQuery<MachineWithMetric[]>({
    queryKey: ['monitoring', 'all-machines'],
    queryFn: () => apiGet<MachineWithMetric[]>('/api/monitoring/machines'),
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

export function useMachineDetail(machineId: string | null) {
  return useQuery<MachineDetail>({
    queryKey: ['monitoring', 'machine-detail', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}`),
    enabled: !!machineId,
    refetchInterval: FALLBACK_REFETCH_MONITORING,
  });
}

export type MetricPeriod = '1h' | '6h' | '24h' | '7d';

export function useMachineMetrics(machineId: string | null, limit = 100) {
  return useQuery<MetricRow[]>({
    queryKey: ['monitoring', 'metrics', machineId, limit],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/metrics?limit=${limit}`),
    enabled: !!machineId,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 5 * 60_000, // Coleta de lixo ativa (5 min) para não reter payloads de telemetria
  });
}

export function useMachineMetricsByPeriod(machineId: string | null, period: MetricPeriod) {
  return useQuery<MetricRow[]>({
    queryKey: ['monitoring', 'metrics', machineId, 'period', period],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/metrics?period=${period}`),
    enabled: !!machineId,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useMachineAlerts(machineId: string | null) {
  return useQuery<AlertRow[]>({
    queryKey: ['monitoring', 'alerts', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/alerts`),
    enabled: !!machineId,
    refetchInterval: 30_000,
    gcTime: 5 * 60_000,
  });
}

// Histórico de chamados abertos por esta máquina — na prática, todo
// chamado aberto por qualquer pessoa que usou essa máquina, já que
// "Abrir Chamado" sempre autentica pelo mesmo usuário-fantasma dela
// (ver lib.MachineGhostEmail no backend). Não é "meus chamados", é
// "chamados desta máquina".
export interface MachineTicket {
  id: string;
  ticket_number: number;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export function useMachineTickets(machineId: string | null) {
  return useQuery<MachineTicket[]>({
    queryKey: ['monitoring', 'machine-tickets', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/tickets`),
    enabled: !!machineId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      machineId,
      command,
      executed_by_user_id,
      executed_by_name,
    }: {
      machineId: string;
      command: string;
      executed_by_user_id?: string;
      executed_by_name?: string;
    }) =>
      apiPost<{ id: string }>(`/api/monitoring/machines/${machineId}/commands`, {
        command,
        executed_by_user_id,
        executed_by_name,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'commands', variables.machineId] });
    },
  });
}

export function useMachineCommands(machine_id: string | null) {
  return useQuery<CommandRow[]>({
    queryKey: ['monitoring', 'commands', machine_id],
    queryFn: async () => {
      return apiGet<CommandRow[]>(`/api/monitoring/machines/${machine_id}/commands`);
    },
    enabled: !!machine_id,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => {
      const commands = query.state.data;
      if (commands?.some(c => c.status === 'pending' || c.status === 'sent')) {
        return 3000;
      }
      return 10000;
    },
  });
}

export function useUpdateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MachineWithMetric> }) => {
      return apiPost(`/api/monitoring/machines/${id}/update`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

// Força o enfileiramento de uma atualização pra UMA máquina, sem esperar o
// próximo heartbeat detectar a divergência de versão sozinho — útil quando
// o admin sabe que o binário em disco está desatualizado mesmo que o
// último heartbeat reportado não reflita isso (ex: bandeja presa numa
// versão antiga até um restart manual).
export function useForceUpdateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (machineId: string) =>
      apiPost<{ success: boolean; enqueued: boolean; message?: string }>(
        `/api/monitoring/machines/${machineId}/force-update`, {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

export interface ForceUpdateOutdatedResult {
  success: boolean;
  enqueued: number;
  already_pending: number;
  already_updated: number;
  errors: string[];
}

// Força atualização em TODAS as máquinas desatualizadas do escopo do
// chamador de uma vez — o botão "Atualizar todas" pro caso comum de várias
// máquinas terem ficado pra trás.
export function useForceUpdateOutdated() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<ForceUpdateOutdatedResult>('/api/monitoring/machines/force-update-outdated', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

export function useDeleteMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Try API endpoint with fallback
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetchWithTimeout(`${API_URL}/api/monitoring/machines/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeoutMs: 8000,
        });
        if (res.ok) {
          return await res.json().catch(() => ({ success: true }));
        }
      } catch (err) {
        console.warn('[useDeleteMachine] API endpoint failed, fallback to Supabase client', err);
      }

      // 2. Direct Supabase client cascade delete
      await supabase.from('machine_hardware' as any).delete().eq('machine_id', id);
      await supabase.from('machine_alerts' as any).delete().eq('machine_id', id);
      await supabase.from('machine_commands' as any).delete().eq('machine_id', id);

      const { error } = await supabase.from('machines' as any).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (group: Partial<MachineGroup> & { company_id?: string }) => {
      return apiPost(`/api/monitoring/groups`, group);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'groups'] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MachineGroup> }) => {
      return apiPost(`/api/monitoring/groups/${id}/update`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'groups'] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithTimeout(`${import.meta.env.VITE_API_URL}/api/monitoring/groups/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        timeoutMs: 15000,
      });
      if (!response.ok) throw new Error('Erro ao deletar grupo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'groups'] });
    },
  });
}

// Helper — pct safe
export function pct(used: number | null, total: number | null): number {
  if (!used || !total || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

// Helper — disk alert
export function hasDiskAlert(m: MachineWithMetric): boolean {
  return pct(m.disk_used, m.disk_total) > 90;
}

// Helper — format bytes (e.g. 16958373888 -> "15.8 GB", 212 GB / 255 GB, TB)
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '–';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(Math.max(0, i), sizes.length - 1);
  const value = bytes / Math.pow(k, idx);
  if (idx === 0) return `${Math.round(value)} B`;
  const formatted = value >= 100 ? `${Math.round(value)} ${sizes[idx]}` : `${value.toFixed(1)} ${sizes[idx]}`;
  return formatted;
}

// Helper — format uptime (e.g. 42845 -> "11h 54m", >24h -> "2d 4h")
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '–';
  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${secs}s`;
}

// ─── Critical Alerts (Red Zone Dashboard) ────────────────
export interface CriticalAlertItem {
  machine_id: string;
  hostname: string;
  group_name?: string | null;
  domain?: string | null;
  current_user?: string | null;
  ip_address?: string | null;
  status: string;
  last_seen: string | null;
  alert_type: 'offline' | 'disk' | 'cpu' | 'antivirus' | 'firewall' | 'updates' | 'alert' | string;
  severity: 'critical' | 'warning' | string;
  message: string;
  metric_value?: number | null;
}

export function useCriticalAlerts() {
  return useQuery<CriticalAlertItem[]>({
    queryKey: ['monitoring', 'alerts', 'critical'],
    queryFn: () => apiGet('/api/monitoring/alerts/critical'),
    refetchInterval: 30_000,
  });
}

// PlatformHealth — Fase 10 do plano de escalabilidade ("monitorar o
// monitor"). Cross-tenant, restrito a master/developer no backend
// (escopo.Global()) — ver handler.monitoringPlatformHealth.
export interface PlatformHealth {
  machines_total: number;
  machines_online: number;
  machines_offline: number;
  machines_alerta: number;
  machines_by_device_type: Record<string, number>;
  alerts_open: number;
  commands_pending: number;
  oldest_pending_command_age_seconds: number | null;
  rate_limit_active_buckets: number;
}

export function usePlatformHealth() {
  return useQuery<PlatformHealth>({
    queryKey: ['monitoring', 'platform-health'],
    queryFn: () => apiGet('/api/monitoring/platform-health'),
    refetchInterval: 30_000,
    retry: false, // 403 para quem não é master/developer não deve ficar retentando
  });
}
