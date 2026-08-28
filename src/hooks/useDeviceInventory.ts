import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DeviceType = 'desktop' | 'notebook' | 'server' | 'Computador' | 'Notebook' | 'Servidor';
export type DeviceStatus = 'online' | 'offline' | 'alerta';

export interface DeviceInventoryItem {
  id: string;
  name?: string;
  hostname: string;
  company_id: string;
  company_name: string;
  domain?: string;
  device_type: string;
  os?: string;
  ip_address?: string;
  local_ip?: string;
  mac_address?: string;
  logged_user?: string;
  logged_in_user?: string;
  status: DeviceStatus;
  alerts_count: number;
  tickets_count: number;
  last_seen: string;
  serial_number?: string;
  brand?: string;
  model?: string;
  raw_asset?: any;
  raw_machine?: any;
}

export type DeviceItem = DeviceInventoryItem;

function resolveDeviceType(hwType?: string | null, hostname?: string | null, os?: string | null): string {
  const candidate = (hwType || '').toLowerCase();
  if (candidate.includes('server') || candidate.includes('servidor')) return 'Servidor';
  if (candidate.includes('notebook') || candidate.includes('laptop') || candidate.includes('portable')) return 'Notebook';
  if (candidate.includes('desktop') || candidate.includes('workstation') || candidate.includes('pc')) return 'Computador';

  const host = (hostname || '').toLowerCase();
  const operatingSystem = (os || '').toLowerCase();

  if (
    host.includes('srv') ||
    host.includes('server') ||
    operatingSystem.includes('server') ||
    operatingSystem.includes('ubuntu') ||
    operatingSystem.includes('debian')
  ) {
    return 'Servidor';
  }
  if (
    host.includes('note') ||
    host.includes('laptop') ||
    host.includes('book') ||
    operatingSystem.includes('macbook')
  ) {
    return 'Notebook';
  }
  return 'Computador';
}

function resolveStatus(status?: string | null, lastSeen?: string | null): DeviceStatus {
  if (status === 'online') return 'online';
  if (status === 'offline') return 'offline';
  if (status === 'alerta') return 'alerta';
  if (!lastSeen) return 'offline';

  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs <= 10 * 60 * 1000 ? 'online' : 'offline';
}

function extractLocalIp(machine: any, hardware: any): string {
  if (machine?.ip_address && machine.ip_address !== '127.0.0.1') return machine.ip_address;
  if (machine?.local_ip && machine.local_ip !== '127.0.0.1') return machine.local_ip;
  if (hardware?.local_ip && hardware.local_ip !== '127.0.0.1') return hardware.local_ip;
  const ifaces = hardware?.interfaces || hardware?.network_interfaces;
  if (Array.isArray(ifaces) && ifaces.length > 0) {
    const ni = ifaces.find((i: any) => (i?.ip || i?.address) && i?.ip !== '127.0.0.1' && i?.address !== '127.0.0.1');
    if (ni?.ip) return ni.ip;
    if (ni?.address) return ni.address;
  }
  return machine?.ip_address || machine?.local_ip || '—';
}

function extractMacAddress(machine: any, hardware: any): string {
  if (machine?.mac_address && machine.mac_address !== '00:00:00:00:00:00') return machine.mac_address;
  if (machine?.mac && machine.mac !== '00:00:00:00:00:00') return machine.mac;
  if (hardware?.mac_address && hardware.mac_address !== '00:00:00:00:00:00') return hardware.mac_address;
  if (hardware?.mac && hardware.mac !== '00:00:00:00:00:00') return hardware.mac;
  const ifaces = hardware?.interfaces || hardware?.network_interfaces;
  if (Array.isArray(ifaces) && ifaces.length > 0) {
    const ni = ifaces.find((i: any) => (i?.mac || i?.mac_address) && i?.mac !== '00:00:00:00:00:00' && i?.mac_address !== '00:00:00:00:00:00');
    if (ni?.mac) return ni.mac;
    if (ni?.mac_address) return ni.mac_address;
  }
  return machine?.mac_address || '—';
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

  const query = useQuery<DeviceItem[]>({
    queryKey: ['device-inventory', companyId || 'all'],
    queryFn: async (): Promise<DeviceItem[]> => {
      try {
        const [
          machinesRes,
          hardwareRes,
          companiesRes,
          machineTicketCountsRes,
          alertsRes,
        ] = await Promise.all([
          supabase
            .from('machines' as any)
            .select('id, hostname, company_id, domain, status, last_seen, metrics_collected_at, created_at, approval_status, os, local_ip, mac_address, logged_in_user, current_user, device_type, ip_address'),
          supabase
            .from('machine_hardware' as any)
            .select('id, machine_id, cpu_model, ram_slots, disks, gpu, interfaces, security_info, remote_software, battery_info, update_status'),
          supabase
            .from('companies')
            .select('id, name'),
          supabase
            .rpc('machine_ticket_counts' as any),
          supabase
            .from('machine_alerts' as any)
            .select('machine_id, resolved')
            .eq('resolved', false),
        ]);

        if (machinesRes.error) {
          console.warn('[useDeviceInventory] Erro na consulta de máquinas:', machinesRes.error);
        }

        const rawMachines = (machinesRes.data as any[]) || [];
        // Filtra máquinas excluindo apenas as explicitamente rejeitadas
        const machines = rawMachines.filter((m) => m.approval_status !== 'rejected');
        const hardwareList = (hardwareRes.data as any[]) || [];
        const companies = (companiesRes.data as any[]) || [];
        const machineTicketCounts = (machineTicketCountsRes.data as any[]) || [];
        const alerts = (alertsRes.data as any[]) || [];

        if (machines.length === 0) {
          return [];
        }

        const companyMap = new Map<string, string>();
        (companies || []).forEach((c) => {
          if (c?.id && c?.name) companyMap.set(c.id, c.name);
        });

        const hardwareMap = new Map<string, any>();
        (hardwareList || []).forEach((h) => {
          const key = h?.machine_id || h?.id;
          if (key) hardwareMap.set(key, h);
        });

        const alertsCountMap = new Map<string, number>();
        (alerts || []).forEach((a) => {
          const mId = a?.machine_id;
          if (mId && !a?.resolved) {
            alertsCountMap.set(mId, (alertsCountMap.get(mId) || 0) + 1);
          }
        });

        const ticketsCountMap = new Map<string, number>();
        (machineTicketCounts || []).forEach((row) => {
          if (row?.machine_id) {
            ticketsCountMap.set(row.machine_id, Number(row.tickets_count) || 0);
          }
        });

        const inventory: DeviceItem[] = (machines || []).map((m) => {
          const hw = hardwareMap.get(m.id) || {};
          const compName = m.company_id ? companyMap.get(m.company_id) || 'Empresa Não Identificada' : 'Sem Empresa';

          const osStr = m.os || 'Windows 11 Pro';
          const localIp = extractLocalIp(m, hw);
          const macAddress = extractMacAddress(m, hw);
          const loggedInUser = m.logged_in_user || m.current_user || 'N/A';
          const deviceType = resolveDeviceType(m.device_type, m.hostname, osStr);
          const lastSeen = m.last_seen || m.metrics_collected_at || m.created_at || new Date().toISOString();
          const baseStatus = resolveStatus(m.status, lastSeen);
          const alertsCount = alertsCountMap.get(m.id) || 0;
          const ticketsCount = ticketsCountMap.get(m.id) || 0;
          const status = baseStatus === 'online' && alertsCount > 0 ? 'alerta' : baseStatus;

          const rawHost = m.hostname || `HOST-${m.id.slice(0, 6)}`;
          const cleanHostname = rawHost.includes(' - ') ? rawHost.split(' - ')[0].trim() : rawHost.trim();
          const cleanName = cleanHostname;

          const domainRaw = m.domain || '';
          const cleanDomain = (!domainRaw || domainRaw === '.') ? 'WORKGROUP' : domainRaw;

          return {
            id: m.id,
            name: cleanName,
            hostname: cleanHostname,
            company_id: m.company_id || '',
            company_name: compName,
            domain: cleanDomain,
            device_type: deviceType,
            os: osStr,
            local_ip: localIp,
            ip_address: localIp,
            mac_address: macAddress,
            logged_in_user: loggedInUser,
            logged_user: loggedInUser,
            status,
            alerts_count: alertsCount,
            tickets_count: ticketsCount,
            last_seen: lastSeen,
            serial_number: '',
            brand: '',
            model: '',
            raw_asset: null,
            raw_machine: m,
            hardware: hw,
          };
        });

        let filtered = inventory;
        if (companyId && companyId !== 'all') {
          filtered = (filtered || []).filter((d) => d.company_id === companyId);
        }

        return filtered || [];
      } catch (err) {
        console.warn('[useDeviceInventory] Erro ao buscar inventário de dispositivos:', err);
        return [];
      }
    },
    refetchInterval,
    staleTime: 10_000,
  });

  const devices = query.data || [];

  const summaryStats = {
    totalDevices: (devices || []).length,
    desktopsCount: (devices || []).filter((d) => d.device_type === 'Computador' || d.device_type === 'desktop').length,
    notebooksCount: (devices || []).filter((d) => d.device_type === 'Notebook' || d.device_type === 'notebook').length,
    serversCount: (devices || []).filter((d) => d.device_type === 'Servidor' || d.device_type === 'server').length,
    onlineCount: (devices || []).filter((d) => d.status === 'online').length,
    offlineCount: (devices || []).filter((d) => d.status === 'offline').length,
    alertCount: (devices || []).filter((d) => d.status === 'alerta' || (d.alerts_count && d.alerts_count > 0)).length,
  };

  return {
    devices,
    summaryStats,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    data: devices,
  };
}

