import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  WifiOff,
  HardDrive,
  Cpu,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Lock,
  Clock,
  Globe,
  Network,
  User,
  RotateCcw,
  Activity,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  useCriticalAlerts,
  useMonitoringDashboard,
  useAllMachines,
  pct,
} from '@/hooks/useMonitoring';
import type { CriticalAlertItem, MachineWithMetric } from '@/hooks/useMonitoring';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { PageHeader } from '@/components/shared/PageHeader';

export interface AlertsDashboardProps {
  onAlertClick?: (machineId: string) => void;
  hideHeader?: boolean;
}

// ── Alert Card ──────────────────────────────────────────────
function AlertCard({
  alert,
  onOpenMachine,
}: {
  alert: CriticalAlertItem;
  onOpenMachine: (machineId: string) => void;
}) {
  const iconMap: Record<string, any> = {
    antivirus: ShieldAlert,
    firewall: ShieldAlert,
    updates: RotateCcw,
    offline: WifiOff,
    disk: HardDrive,
    cpu: Cpu,
    alert: AlertTriangle,
  };

  const colorMap: Record<string, { bg: string; border: string; text: string; icon: string; badge: string }> = {
    antivirus: {
      bg: 'bg-rose-500/10 dark:bg-rose-950/20',
      border: 'border-rose-500/30',
      text: 'text-rose-600 dark:text-rose-400',
      icon: 'bg-rose-600 shadow-rose-600/30',
      badge: 'bg-rose-500 text-white',
    },
    firewall: {
      bg: 'bg-red-500/10 dark:bg-red-950/20',
      border: 'border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      icon: 'bg-red-600 shadow-red-600/30',
      badge: 'bg-red-500 text-white',
    },
    updates: {
      bg: 'bg-amber-500/10 dark:bg-amber-950/20',
      border: 'border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'bg-amber-600 shadow-amber-600/30',
      badge: 'bg-amber-500 text-white',
    },
    offline: {
      bg: 'bg-red-500/10 dark:bg-red-950/20',
      border: 'border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      icon: 'bg-red-600 shadow-red-600/30',
      badge: 'bg-red-500 text-white',
    },
    disk: {
      bg: 'bg-orange-500/10 dark:bg-orange-950/20',
      border: 'border-orange-500/30',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'bg-orange-600 shadow-orange-600/30',
      badge: 'bg-orange-500 text-white',
    },
    cpu: {
      bg: 'bg-amber-500/10 dark:bg-amber-950/20',
      border: 'border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'bg-amber-500 shadow-amber-500/30',
      badge: 'bg-amber-500 text-white',
    },
    alert: {
      bg: 'bg-rose-500/10 dark:bg-rose-950/20',
      border: 'border-rose-500/30',
      text: 'text-rose-600 dark:text-rose-400',
      icon: 'bg-rose-600 shadow-rose-600/30',
      badge: 'bg-rose-500 text-white',
    },
  };

  const Icon = iconMap[alert.alert_type] || AlertTriangle;
  const colors = colorMap[alert.alert_type] || colorMap.alert;

  return (
    <Card
      onClick={() => onOpenMachine(alert.machine_id)}
      className={cn(
        'border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg group cursor-pointer relative',
        colors.bg,
        colors.border
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'p-2.5 rounded-xl text-white shadow-md flex-shrink-0 transition-transform group-hover:scale-105',
              colors.icon,
              alert.severity === 'critical' && 'animate-pulse'
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-bold text-sm text-foreground truncate tracking-tight" title={alert.hostname}>
                {alert.hostname}
              </h4>
              <Badge
                className={cn(
                  'text-[9px] font-black uppercase tracking-wider px-2 py-0 h-4 border-none shrink-0',
                  colors.badge
                )}
              >
                {alert.severity === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'}
              </Badge>
            </div>

            <p className={cn('text-xs font-semibold leading-snug', colors.text)}>
              {alert.message}
            </p>
          </div>
        </div>

        {/* Identification Grid (Domínio, Usuário, IP, Last Seen / Metric) */}
        <div className="bg-background/60 dark:bg-background/40 rounded-xl p-2.5 border border-border/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {/* Domínio / Cliente */}
          <div className="flex items-center gap-1.5 min-w-0" title={`Domínio/Cliente: ${alert.domain || alert.group_name || 'WORKGROUP'}`}>
            <Network className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">DOM:</span>
            <span className="font-medium text-foreground truncate text-[10.5px]">
              {alert.domain || alert.group_name || 'WORKGROUP'}
            </span>
          </div>

          {/* Usuário Ativo */}
          <div className="flex items-center gap-1.5 min-w-0" title={`Usuário Ativo: ${alert.current_user || '–'}`}>
            <User className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">USR:</span>
            <span className="font-medium text-foreground truncate text-[10.5px]">
              {alert.current_user || '–'}
            </span>
          </div>

          {/* IP Interno */}
          <div className="flex items-center gap-1.5 min-w-0" title={`IP Interno: ${alert.ip_address || '–'}`}>
            <Globe className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">IP:</span>
            <span className="font-mono text-muted-foreground text-[10.5px] truncate">
              {alert.ip_address || '–'}
            </span>
          </div>

          {/* Metric / Last seen */}
          <div className="flex items-center gap-1.5 min-w-0">
            {alert.metric_value != null ? (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">USO:</span>
                <span className={cn('font-bold font-mono text-[10.5px]', colors.text)}>
                  {alert.metric_value}%
                </span>
              </div>
            ) : alert.last_seen ? (
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] truncate" title={`Visto por último: ${formatDistanceToNow(new Date(alert.last_seen), { locale: ptBR, addSuffix: true })}`}>
                <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                <span className="truncate">{formatDistanceToNow(new Date(alert.last_seen), { locale: ptBR, addSuffix: true })}</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground font-mono">–</span>
            )}
          </div>
        </div>

        {/* Footer with Button to Open Machine */}
        <div className="pt-1 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs font-semibold rounded-lg gap-1.5 bg-background/80 hover:bg-background shadow-xs group-hover:border-primary/40 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMachine(alert.machine_id);
            }}
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            Abrir Máquina
            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section ─────────────────────────────────────────────────
function AlertSection({
  title,
  icon: Icon,
  colorClass,
  badgeColor,
  alerts,
  onOpenMachine,
}: {
  title: string;
  icon: React.ElementType;
  colorClass: string;
  badgeColor?: string;
  alerts: CriticalAlertItem[];
  onOpenMachine: (machineId: string) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <section className="space-y-3.5">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl text-white shadow-md', colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-black',
            badgeColor || colorClass.replace('bg-', 'text-').replace('-600', '-500')
          )}
        >
          {alerts.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {alerts.map((a, i) => (
          <AlertCard
            key={`${a.machine_id}-${a.alert_type}-${i}`}
            alert={a}
            onOpenMachine={onOpenMachine}
          />
        ))}
      </div>
    </section>
  );
}

// ── Main Page ───────────────────────────────────────────────
const AlertsDashboard: React.FC<AlertsDashboardProps> = ({ onAlertClick, hideHeader }) => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: apiAlerts = [], isLoading: alertsLoading } = useCriticalAlerts();
  const { data: allMachines = [], isLoading: machinesLoading } = useAllMachines();
  const { data: dashboard } = useMonitoringDashboard();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const machinesMap = useMemo(() => {
    const map = new Map<string, MachineWithMetric>();
    for (const m of allMachines) {
      map.set(m.id, m);
    }
    return map;
  }, [allMachines]);

  // Consolidate backend alerts with client-evaluated telemetry & compliance items
  const mergedAlerts = useMemo(() => {
    const list: CriticalAlertItem[] = [];
    const seenKeys = new Set<string>();

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Helper to evaluate if a machine is online right now (last 5 min)
    const isOnlineNow = (status: string, lastSeen?: string | null) => {
      if (status === 'online' || status === 'alerta') return true;
      if (!lastSeen) return false;
      return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
    };

    // Helper to evaluate if a machine is inactive for MORE than 7 days
    const isInactiveOver7Days = (status: string, lastSeen?: string | null) => {
      if (!lastSeen) return status === 'offline';
      const diffMs = Date.now() - new Date(lastSeen).getTime();
      return diffMs > SEVEN_DAYS_MS;
    };

    // 1. Process API alerts
    for (const alert of apiAlerts) {
      const machine = machinesMap.get(alert.machine_id);

      // Guard: Only show offline alert if inactive for > 7 days
      if (alert.alert_type === 'offline') {
        const currentStatus = machine?.status || alert.status;
        const currentLastSeen = machine?.last_seen || alert.last_seen;
        if (!isInactiveOver7Days(currentStatus, currentLastSeen)) {
          continue;
        }
      }

      const enriched: CriticalAlertItem = {
        ...alert,
        domain: alert.domain || machine?.domain || 'WORKGROUP',
        current_user: alert.current_user || machine?.current_user || null,
        ip_address: alert.ip_address || machine?.ip_address || null,
        group_name: alert.group_name || machine?.domain || null,
      };
      const key = `${enriched.machine_id}-${enriched.alert_type}`;
      seenKeys.add(key);
      list.push(enriched);
    }

    // 2. Scan machines for compliance, security, and hardware alerts
    for (const m of allMachines) {
      const isOnline = isOnlineNow(m.status, m.last_seen);

      // 🛡️ Antivirus: Alert ONLY if antivirus list is non-empty and NO active protection is detected
      if (m.security_info?.antivirus && m.security_info.antivirus.length > 0) {
        const hasActiveAv = m.security_info.antivirus.some((a) => a.active);
        if (!hasActiveAv) {
          const key = `${m.id}-antivirus`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            list.push({
              machine_id: m.id,
              hostname: m.hostname,
              domain: m.domain || 'WORKGROUP',
              current_user: m.current_user || null,
              ip_address: m.ip_address || null,
              group_name: m.domain || null,
              status: m.status,
              last_seen: m.last_seen,
              alert_type: 'antivirus',
              severity: 'critical',
              message: `Antivírus desativado: ${m.security_info.antivirus.map((a) => a.name).join(', ')}`,
            });
          }
        }
      }

      // 🧱 Firewall
      if (m.security_info?.firewall_active === false) {
        const key = `${m.id}-firewall`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            machine_id: m.id,
            hostname: m.hostname,
            domain: m.domain || 'WORKGROUP',
            current_user: m.current_user || null,
            ip_address: m.ip_address || null,
            group_name: m.domain || null,
            status: m.status,
            last_seen: m.last_seen,
            alert_type: 'firewall',
            severity: 'critical',
            message: 'Firewall do Windows desligado no dispositivo',
          });
        }
      }

      // 🔴 Máquinas Inativas > 7 dias: APENAS se sem comunicação por mais de 7 dias
      if (isInactiveOver7Days(m.status, m.last_seen)) {
        const key = `${m.id}-offline`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            machine_id: m.id,
            hostname: m.hostname,
            domain: m.domain || 'WORKGROUP',
            current_user: m.current_user || null,
            ip_address: m.ip_address || null,
            group_name: m.domain || null,
            status: m.status,
            last_seen: m.last_seen,
            alert_type: 'offline',
            severity: 'warning',
            message: 'Dispositivo inativo há mais de 7 dias sem comunicação',
          });
        }
      }

      // 💾 Disk Alert (fallback if not in API list)
      const diskPct = pct(m.disk_used, m.disk_total);
      if (diskPct > 90) {
        const key = `${m.id}-disk`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            machine_id: m.id,
            hostname: m.hostname,
            domain: m.domain || 'WORKGROUP',
            current_user: m.current_user || null,
            ip_address: m.ip_address || null,
            group_name: m.domain || null,
            status: m.status,
            last_seen: m.last_seen,
            alert_type: 'disk',
            severity: 'critical',
            message: `Armazenamento crítico (${diskPct}% utilizado)`,
            metric_value: diskPct,
          });
        }
      }

      // ⚡ CPU Alert (fallback if not in API list - only for online or alert active machines)
      if (isOnline && m.cpu_usage != null && m.cpu_usage > 85) {
        const key = `${m.id}-cpu`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            machine_id: m.id,
            hostname: m.hostname,
            domain: m.domain || 'WORKGROUP',
            current_user: m.current_user || null,
            ip_address: m.ip_address || null,
            group_name: m.domain || null,
            status: m.status,
            last_seen: m.last_seen,
            alert_type: 'cpu',
            severity: 'warning',
            message: `CPU sob estresse elevado (${Math.round(m.cpu_usage)}% de uso)`,
            metric_value: Math.round(m.cpu_usage),
          });
        }
      }
    }

    return list;
  }, [apiAlerts, allMachines, machinesMap]);

  // Group alerts by functional category
  const grouped = useMemo(() => {
    return {
      antivirus: mergedAlerts.filter((a) => a.alert_type === 'antivirus'),
      firewall: mergedAlerts.filter((a) => a.alert_type === 'firewall'),
      offline: mergedAlerts.filter((a) => a.alert_type === 'offline'),
      disk: mergedAlerts.filter((a) => a.alert_type === 'disk'),
      cpu: mergedAlerts.filter((a) => a.alert_type === 'cpu'),
      alert: mergedAlerts.filter((a) => !['antivirus', 'firewall', 'offline', 'disk', 'cpu'].includes(a.alert_type)),
    };
  }, [mergedAlerts]);

  const selectedMachine = useMemo(
    () => (selectedMachineId ? machinesMap.get(selectedMachineId) || null : null),
    [selectedMachineId, machinesMap]
  );

  const handleOpenMachine = (mId: string) => {
    if (onAlertClick) {
      onAlertClick(mId);
    } else {
      setSelectedMachineId(mId);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['critical-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['monitoring-machines'] }),
      queryClient.invalidateQueries({ queryKey: ['monitoring-dashboard'] }),
    ]);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 800);
  };

  const isLoading = alertsLoading && machinesLoading;

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'customer') {
    return <Navigate to="/conhecimento" replace />;
  }

  if (role && !['admin', 'developer', 'technician'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 space-y-4 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você não tem permissão para acessar esta área técnica.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
        {/* Header */}
        {hideHeader ? (
          <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-border/40">
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 font-bold px-3 py-1.5 rounded-xl',
                mergedAlerts.length > 0
                  ? 'text-red-600 border-red-500/30 bg-red-500/10'
                  : 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {mergedAlerts.length} alerta{mergedAlerts.length !== 1 ? 's' : ''} ativo{mergedAlerts.length !== 1 ? 's' : ''}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2 rounded-xl font-bold h-10 px-4"
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        ) : (
          <PageHeader
            icon={AlertTriangle}
            badge="ZONA VERMELHA & CONFORMIDADE"
            title="Central de Alertas"
            description="Supervisão de riscos imediatos, falhas de segurança e conformidade da frota."
            actions={
              <>
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1.5 font-bold px-3 py-1.5 rounded-xl',
                    mergedAlerts.length > 0
                      ? 'text-red-600 border-red-500/30 bg-red-500/10'
                      : 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {mergedAlerts.length} alerta{mergedAlerts.length !== 1 ? 's' : ''} ativo{mergedAlerts.length !== 1 ? 's' : ''}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="gap-2 rounded-xl font-bold h-10 px-4"
                  disabled={refreshing}
                >
                  <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                  Atualizar
                </Button>
              </>
            }
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : mergedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="p-8 bg-emerald-500/10 rounded-full">
                <ShieldCheck className="h-16 w-16 text-emerald-500" />
              </div>
              <span className="absolute bottom-2 right-2 h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-black">
                ✓
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground mb-2">Tudo Conforme &amp; Seguro!</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Nenhum alerta crítico no momento. Todos os dispositivos monitorados estão operando com segurança, conformidade e limites saudáveis.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 6-Column KPI Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { label: 'Total Crítico', value: mergedAlerts.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/25' },
                { label: 'Sem Antivírus', value: grouped.antivirus.length, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25' },
                { label: 'Firewall Off', value: grouped.firewall.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/25' },
                { label: 'Inativo >7d', value: grouped.offline.length, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/25' },
                { label: 'Disco >90%', value: grouped.disk.length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
                { label: 'CPU >85%', value: grouped.cpu.length, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
              ].map((kpi) => (
                <div key={kpi.label} className={cn('p-3 rounded-xl border flex flex-col justify-between shadow-xs', kpi.bg)}>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground truncate">{kpi.label}</span>
                  <span className={cn('text-xl font-black font-mono mt-1', kpi.color)}>{kpi.value}</span>
                </div>
              ))}
            </div>

            <ScrollArea className="h-[calc(100vh-270px)]">
              <div className="space-y-8 pr-4 pb-12">
                {/* 1. Segurança & Antivírus Crítico */}
                <AlertSection
                  title="Segurança & Antivírus Crítico (Zona Vermelha)"
                  icon={ShieldAlert}
                  colorClass="bg-rose-600"
                  alerts={grouped.antivirus}
                  onOpenMachine={handleOpenMachine}
                />

              {/* 2. Conformidade & Firewall */}
              <AlertSection
                title="Conformidade & Firewall Inativo"
                icon={Shield}
                colorClass="bg-red-600"
                alerts={grouped.firewall}
                onOpenMachine={handleOpenMachine}
              />

              {/* 4. Dispositivos Inativos > 7 dias */}
              <AlertSection
                title="Dispositivos Inativos há mais de 7 Dias"
                icon={WifiOff}
                colorClass="bg-zinc-600"
                alerts={grouped.offline}
                onOpenMachine={handleOpenMachine}
              />

              {/* 5. Disco Crítico (>90%) */}
              <AlertSection
                title="Disco Crítico (>90%)"
                icon={HardDrive}
                colorClass="bg-orange-600"
                alerts={grouped.disk}
                onOpenMachine={handleOpenMachine}
              />

              {/* 6. CPU sob Pressão (>85%) */}
              <AlertSection
                title="CPU Sob Pressão (>85%)"
                icon={Cpu}
                colorClass="bg-amber-500"
                alerts={grouped.cpu}
                onOpenMachine={handleOpenMachine}
              />

              {/* 7. Alertas Gerais do Sistema */}
              <AlertSection
                title="Alertas Gerais do Sistema"
                icon={AlertTriangle}
                colorClass="bg-rose-500"
                alerts={grouped.alert}
                onOpenMachine={handleOpenMachine}
              />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Machine Details Drawer */}
      <MachineDrawer
        machine={selectedMachine}
        open={!!selectedMachineId}
        onClose={() => setSelectedMachineId(null)}
        initialTab="overview"
      />
    </div>
  );
};

const AlertsDashboardWrapper: React.FC<AlertsDashboardProps> = (props) => (
  <ErrorBoundary>
    <AlertsDashboard {...props} />
  </ErrorBoundary>
);

export default AlertsDashboardWrapper;

