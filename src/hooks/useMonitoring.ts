import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Falls back to empty string → relative URL /api/monitoring/... (same Vercel domain)
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

async function apiGet<T>(path: string): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────
export interface MachineGroup {
  id: string;
  name: string;
  description: string | null;
  client_contact: string | null;
  total_machines: number;
  online_machines: number;
}

export interface MachineWithMetric {
  id: string;
  group_id: string | null;
  hostname: string;
  ip_address: string | null;
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
  ram_slots: unknown;
  disks: unknown;
  gpu: string | null;
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

export function useMachineDetail(machineId: string | null) {
  return useQuery<MachineDetail>({
    queryKey: ['monitoring', 'machine-detail', machineId],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}`),
    enabled: !!machineId,
    refetchInterval: 30_000,
  });
}

export function useMachineMetrics(machineId: string | null, limit = 100) {
  return useQuery<MetricRow[]>({
    queryKey: ['monitoring', 'metrics', machineId, limit],
    queryFn: () => apiGet(`/api/monitoring/machines/${machineId}/metrics?limit=${limit}`),
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

// Helper — pct safe
export function pct(used: number | null, total: number | null): number {
  if (!used || !total || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

// Helper — disk alert
export function hasDiskAlert(m: MachineWithMetric): boolean {
  return pct(m.disk_used, m.disk_total) > 90;
}
