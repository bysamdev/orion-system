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

export interface BatteryInfo {
  has_battery: boolean;
  percentage?: number;
  is_plugged?: boolean;
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
}

// ─── Hooks ───────────────────────────────────────────────
export function useMonitoringDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => apiGet('/api/monitoring/dashboard'),
    refetchInterval: 30_000,
  });
}

export function useMonitoringGroups() {
  return useQuery<MachineGroup[]>({
    queryKey: ['monitoring', 'groups'],
    queryFn: () => apiGet('/api/monitoring/groups'),
    refetchInterval: 30_000,
  });
}

export function useGroupMachines(groupId: string | null) {
  return useQuery<MachineWithMetric[]>({
    queryKey: ['monitoring', 'group-machines', groupId],
    queryFn: () => apiGet(`/api/monitoring/groups/${groupId}/machines`),
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useAllMachines() {
  const { data: groups = [] } = useMonitoringGroups();
  return useQuery<MachineWithMetric[]>({
    queryKey: ['monitoring', 'all-machines', groups.map(g => g.id).join(',')],
    queryFn: async () => {
      if (groups.length === 0) return [];
      const results = await Promise.all(
        groups.map(g =>
          apiGet<MachineWithMetric[]>(`/api/monitoring/groups/${g.id}/machines`).catch(() => [])
        )
      );
      const map = new Map<string, MachineWithMetric>();
      results.flat().forEach(m => {
        if (m && m.id) map.set(m.id, m);
      });
      return Array.from(map.values());
    },
    enabled: groups.length > 0,
    refetchInterval: 30_000,
  });
}

export function useMachineDetail(machineId: string | null) {
  return useQuery<MachineDetail>({
    queryKey: ['monitoring', 'machine-detail', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}`),
    enabled: !!machineId,
    refetchInterval: 30_000,
  });
}

export type MetricPeriod = '1h' | '6h' | '24h' | '7d';

export function useMachineMetrics(machineId: string | null, limit = 100) {
  return useQuery<MetricRow[]>({
    queryKey: ['monitoring', 'metrics', machineId, limit],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/metrics?limit=${limit}`),
    enabled: !!machineId,
    refetchInterval: 60_000,
  });
}

export function useMachineMetricsByPeriod(machineId: string | null, period: MetricPeriod) {
  return useQuery<MetricRow[]>({
    queryKey: ['monitoring', 'metrics', machineId, 'period', period],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/metrics?period=${period}`),
    enabled: !!machineId,
    refetchInterval: 60_000,
  });
}

export function useMachineAlerts(machineId: string | null) {
  return useQuery<AlertRow[]>({
    queryKey: ['monitoring', 'alerts', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/alerts`),
    enabled: !!machineId,
    refetchInterval: 30_000,
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
      await supabase.from('machine_metrics' as any).delete().eq('machine_id', id);
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
