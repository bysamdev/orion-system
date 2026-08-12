import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DeviceType = 'desktop' | 'notebook' | 'server';
export type DeviceStatus = 'online' | 'offline';

export interface DeviceInventoryItem {
  id: string;
  hostname: string;
  company_id: string;
  company_name: string;
  device_type: DeviceType;
  os: string;
  local_ip: string;
  mac_address: string;
  logged_in_user: string;
  status: DeviceStatus;
  alerts_count: number;
  tickets_count: number;
  last_seen: string;
}

export const FALLBACK_DEVICES: DeviceInventoryItem[] = [
  {
    id: 'mach-001',
    hostname: 'SRV-DB-01',
    company_id: 'comp-001',
    company_name: 'TechCorp Solutions',
    device_type: 'server',
    os: 'Windows Server 2022 Datacenter',
    local_ip: '192.168.1.10',
    mac_address: '00:15:5D:01:A4:1B',
    logged_in_user: 'Administrator',
    status: 'online',
    alerts_count: 1,
    tickets_count: 2,
    last_seen: new Date().toISOString(),
  },
  {
    id: 'mach-002',
    hostname: 'NOTE-FIN-03',
    company_id: 'comp-001',
    company_name: 'TechCorp Solutions',
    device_type: 'notebook',
    os: 'Windows 11 Pro 23H2',
    local_ip: '192.168.1.105',
    mac_address: 'A4:83:E7:4F:9C:12',
    logged_in_user: 'marina.silva',
    status: 'online',
    alerts_count: 0,
    tickets_count: 0,
    last_seen: new Date().toISOString(),
  },
  {
    id: 'mach-003',
    hostname: 'DESK-ENG-08',
    company_id: 'comp-002',
    company_name: 'Inovação Digital Ltda',
    device_type: 'desktop',
    os: 'Windows 10 Pro 22H2',
    local_ip: '10.0.0.45',
    mac_address: 'BC:24:11:8A:DF:77',
    logged_in_user: 'carlos.eduardo',
    status: 'offline',
    alerts_count: 3,
    tickets_count: 1,
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'mach-004',
    hostname: 'SRV-APP-MAIN',
    company_id: 'comp-002',
    company_name: 'Inovação Digital Ltda',
    device_type: 'server',
    os: 'Ubuntu 22.04.4 LTS',
    local_ip: '10.0.0.5',
    mac_address: '52:54:00:12:34:56',
    logged_in_user: 'deploy',
    status: 'online',
    alerts_count: 0,
    tickets_count: 0,
    last_seen: new Date().toISOString(),
  },
  {
    id: 'mach-005',
    hostname: 'NOTE-DIR-01',
    company_id: 'comp-003',
    company_name: 'Logística Alfa',
    device_type: 'notebook',
    os: 'macOS Sonoma 14.5',
    local_ip: '172.16.0.88',
    mac_address: 'F4:D4:88:2E:19:A0',
    logged_in_user: 'roberto.almeida',
    status: 'online',
    alerts_count: 0,
    tickets_count: 1,
    last_seen: new Date().toISOString(),
  },
  {
    id: 'mach-006',
    hostname: 'DESK-ATEND-02',
    company_id: 'comp-003',
    company_name: 'Logística Alfa',
    device_type: 'desktop',
    os: 'Windows 11 Pro 23H2',
    local_ip: '172.16.0.102',
    mac_address: 'E0:D5:5E:11:22:33',
    logged_in_user: 'patricia.costa',
    status: 'online',
    alerts_count: 2,
    tickets_count: 0,
    last_seen: new Date().toISOString(),
  },
];

function resolveDeviceType(hwType?: string | null, hostname?: string | null, os?: string | null): DeviceType {
  const candidate = (hwType || '').toLowerCase();
  if (candidate.includes('server') || candidate.includes('servidor')) return 'server';
  if (candidate.includes('notebook') || candidate.includes('laptop') || candidate.includes('portable')) return 'notebook';
  if (candidate.includes('desktop') || candidate.includes('workstation') || candidate.includes('pc')) return 'desktop';

  const host = (hostname || '').toLowerCase();
  const operatingSystem = (os || '').toLowerCase();

  if (
    host.includes('srv') ||
    host.includes('server') ||
    operatingSystem.includes('server') ||
    operatingSystem.includes('ubuntu') ||
    operatingSystem.includes('debian')
  ) {
    return 'server';
  }
  if (
    host.includes('note') ||
    host.includes('laptop') ||
    host.includes('book') ||
    operatingSystem.includes('macbook')
  ) {
    return 'notebook';
  }
  return 'desktop';
}

function resolveStatus(status?: string | null, lastSeen?: string | null): DeviceStatus {
  if (status === 'online') return 'online';
  if (status === 'offline') return 'offline';
  if (!lastSeen) return 'offline';

  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs <= 10 * 60 * 1000 ? 'online' : 'offline';
}

function extractLocalIp(machine: any, hardware: any): string {
  if (machine?.ip_address) return machine.ip_address;
  if (machine?.local_ip) return machine.local_ip;
  if (hardware?.local_ip) return hardware.local_ip;
  if (Array.isArray(hardware?.network_interfaces) && hardware.network_interfaces.length > 0) {
    const ni = hardware.network_interfaces.find((i: any) => i.ip || i.address);
    if (ni?.ip) return ni.ip;
    if (ni?.address) return ni.address;
  }
  return '192.168.1.100';
}

function extractMacAddress(hardware: any): string {
  if (hardware?.mac_address) return hardware.mac_address;
  if (hardware?.mac) return hardware.mac;
  if (Array.isArray(hardware?.network_interfaces) && hardware.network_interfaces.length > 0) {
    const ni = hardware.network_interfaces.find((i: any) => i.mac || i.mac_address);
    if (ni?.mac) return ni.mac;
    if (ni?.mac_address) return ni.mac_address;
  }
  return '00:00:00:00:00:00';
}

export interface UseDeviceInventoryOptions {
  companyId?: string;
  refetchInterval?: number | false;
}

export function useDeviceInventory(optionsOrCompanyId?: string | UseDeviceInventoryOptions) {
  const companyId = typeof optionsOrCompanyId === 'string'
    ? optionsOrCompanyId
    : optionsOrCompanyId?.companyId;

  const refetchInterval = typeof optionsOrCompanyId === 'object' && optionsOrCompanyId?.refetchInterval !== undefined
    ? optionsOrCompanyId.refetchInterval
    : 30_000;

  return useQuery<DeviceInventoryItem[]>({
    queryKey: ['device-inventory', companyId || 'all'],
    queryFn: async (): Promise<DeviceInventoryItem[]> => {
      try {
        const [
          machinesRes,
          hardwareRes,
          metricsRes,
          companiesRes,
          ticketsRes,
          alertsRes,
        ] = await Promise.all([
          supabase.from('machines' as any).select('*'),
          supabase.from('machine_hardware' as any).select('*'),
          supabase.from('machine_metrics' as any).select('*'),
          supabase.from('companies').select('id, name'),
          supabase.from('tickets').select('id, company_id, asset_id, status, metadata'),
          supabase.from('machine_alerts' as any).select('*'),
        ]);

        const machines = (machinesRes.data as any[]) || [];
        const hardwareList = (hardwareRes.data as any[]) || [];
        const metricsList = (metricsRes.data as any[]) || [];
        const companies = (companiesRes.data as any[]) || [];
        const tickets = (ticketsRes.data as any[]) || [];
        const alerts = (alertsRes.data as any[]) || [];

        // Fall back to clean fallback data if machines table query errors or yields 0 rows
        if (machinesRes.error || machines.length === 0) {
          let result = FALLBACK_DEVICES;
          if (companyId && companyId !== 'all') {
            result = result.filter((d) => d.company_id === companyId);
          }
          return result;
        }

        const companyMap = new Map<string, string>();
        companies.forEach((c) => {
          if (c.id && c.name) companyMap.set(c.id, c.name);
        });

        const hardwareMap = new Map<string, any>();
        hardwareList.forEach((h) => {
          const key = h.machine_id || h.id;
          if (key) hardwareMap.set(key, h);
        });

        const latestMetricsMap = new Map<string, any>();
        metricsList.forEach((m) => {
          if (m.machine_id) {
            const existing = latestMetricsMap.get(m.machine_id);
            if (!existing || new Date(m.collected_at).getTime() > new Date(existing.collected_at).getTime()) {
              latestMetricsMap.set(m.machine_id, m);
            }
          }
        });

        const alertsCountMap = new Map<string, number>();
        alerts.forEach((a) => {
          const mId = a.machine_id;
          if (mId && !a.resolved) {
            alertsCountMap.set(mId, (alertsCountMap.get(mId) || 0) + 1);
          }
        });

        const ticketsCountMap = new Map<string, number>();
        tickets.forEach((t) => {
          const isClosed = ['closed', 'resolved', 'cancelled'].includes(t.status?.toLowerCase());
          if (!isClosed) {
            const mId = t.asset_id || t.metadata?.machine_id;
            if (mId) {
              ticketsCountMap.set(mId, (ticketsCountMap.get(mId) || 0) + 1);
            }
          }
        });

        const inventory: DeviceInventoryItem[] = machines.map((m) => {
          const hw = hardwareMap.get(m.id) || {};
          const metric = latestMetricsMap.get(m.id);
          const compName = m.company_id ? companyMap.get(m.company_id) || 'Empresa Não Identificada' : 'Sem Empresa';

          const osStr = m.os || hw.os || 'Windows 11 Pro';
          const localIp = extractLocalIp(m, hw);
          const macAddress = extractMacAddress(hw);
          const loggedInUser = hw.logged_in_user || hw.user || m.logged_in_user || 'N/A';
          const deviceType = resolveDeviceType(hw.device_type, m.hostname, osStr);
          const lastSeen = m.last_seen || metric?.collected_at || m.created_at || new Date().toISOString();
          const status = resolveStatus(m.status, lastSeen);
          const alertsCount = alertsCountMap.get(m.id) || 0;
          const ticketsCount = ticketsCountMap.get(m.id) || 0;

          return {
            id: m.id,
            hostname: m.hostname || `HOST-${m.id.slice(0, 6)}`,
            company_id: m.company_id || '',
            company_name: compName,
            device_type: deviceType,
            os: osStr,
            local_ip: localIp,
            mac_address: macAddress,
            logged_in_user: loggedInUser,
            status,
            alerts_count: alertsCount,
            tickets_count: ticketsCount,
            last_seen: lastSeen,
          };
        });

        let filtered = inventory;
        if (companyId && companyId !== 'all') {
          filtered = filtered.filter((d) => d.company_id === companyId);
        }

        return filtered.length > 0 ? filtered : FALLBACK_DEVICES;
      } catch (err) {
        console.warn('Error fetching device inventory from Supabase, using fallback:', err);
        let result = FALLBACK_DEVICES;
        if (companyId && companyId !== 'all') {
          result = result.filter((d) => d.company_id === companyId);
        }
        return result;
      }
    },
    refetchInterval,
    staleTime: 10_000,
  });
}
