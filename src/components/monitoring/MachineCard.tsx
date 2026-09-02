import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  Activity,
  Terminal,
  Trash2,
  Server,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  RotateCcw,
  Zap,
  Battery,
  Globe,
  User,
  HardDrive,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MachineWithMetric } from '@/hooks/useMonitoring';
import {
  pct,
  hasDiskAlert,
  formatBytes,
  formatUptime,
  useDeleteMachine,
} from '@/hooks/useMonitoring';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export interface MachineCardProps {
  machine: MachineWithMetric;
  onSelect: (machine: MachineWithMetric, initialTab?: string) => void;
  onDelete?: (machine: MachineWithMetric) => void;
}

export function parseOsInfo(os?: string | null, osVersion?: string | null): {
  name: string;
  shortLabel: string;
  type: 'win11' | 'win10' | 'winserver' | 'windows' | 'linux' | 'mac' | 'other';
} {
  const normOs = (os || '').toLowerCase();
  const normVer = (osVersion || '').toLowerCase();

  // Windows Server Check
  if (
    normVer.includes('server') ||
    normOs.includes('server') ||
    normVer.includes('2016') ||
    normVer.includes('2019') ||
    normVer.includes('2022') ||
    normVer.includes('2025')
  ) {
    let year = '';
    if (normVer.includes('2025')) year = ' 2025';
    else if (normVer.includes('2022')) year = ' 2022';
    else if (normVer.includes('2019')) year = ' 2019';
    else if (normVer.includes('2016')) year = ' 2016';
    else if (normVer.includes('2012')) year = ' 2012';
    return { name: `Windows Server${year}`, shortLabel: `Server${year}`, type: 'winserver' };
  }

  // Windows 11 vs Windows 10 vs other Windows
  if (normOs.includes('win') || normVer.includes('windows')) {
    const match = normVer.match(/build\s*(\d+)/i) || normVer.match(/10\.0\.(\d+)/i);
    let buildNum = 0;
    if (match && match[1]) {
      buildNum = parseInt(match[1], 10);
    }

    const isWin11 =
      normVer.includes('11') ||
      normOs.includes('11') ||
      buildNum >= 22000;

    if (isWin11) {
      return { name: 'Windows 11', shortLabel: 'Win 11', type: 'win11' };
    }

    if (normVer.includes('10') || normOs.includes('10') || (buildNum >= 10240 && buildNum < 22000)) {
      return { name: 'Windows 10', shortLabel: 'Win 10', type: 'win10' };
    }

    if (normVer.includes('8.1')) {
      return { name: 'Windows 8.1', shortLabel: 'Win 8.1', type: 'windows' };
    }
    if (normVer.includes('7')) {
      return { name: 'Windows 7', shortLabel: 'Win 7', type: 'windows' };
    }

    return { name: 'Windows', shortLabel: 'Windows', type: 'windows' };
  }

  // Linux
  if (
    normOs.includes('linux') ||
    normVer.includes('ubuntu') ||
    normVer.includes('debian') ||
    normVer.includes('centos') ||
    normVer.includes('redhat') ||
    normVer.includes('rhel') ||
    normVer.includes('arch') ||
    normVer.includes('fedora') ||
    normVer.includes('alpine')
  ) {
    let distro = 'Linux';
    if (normVer.includes('ubuntu') || normOs.includes('ubuntu')) distro = 'Ubuntu';
    else if (normVer.includes('debian') || normOs.includes('debian')) distro = 'Debian';
    else if (normVer.includes('centos') || normOs.includes('centos')) distro = 'CentOS';
    else if (normVer.includes('fedora') || normOs.includes('fedora')) distro = 'Fedora';
    else if (normVer.includes('redhat') || normVer.includes('rhel')) distro = 'Red Hat';
    else if (normVer.includes('arch')) distro = 'Arch';
    else if (normVer.includes('alpine')) distro = 'Alpine';

    return { name: distro, shortLabel: distro, type: 'linux' };
  }

  // macOS
  if (
    normOs.includes('mac') ||
    normOs.includes('darwin') ||
    normOs.includes('apple')
  ) {
    return { name: 'macOS', shortLabel: 'macOS', type: 'mac' };
  }

  return { name: os || 'Desconhecido', shortLabel: os || 'Host', type: 'other' };
}

export function OsIcon({ os, osVersion }: { os?: string | null; osVersion?: string | null }) {
  const osInfo = parseOsInfo(os, osVersion);

  switch (osInfo.type) {
    case 'win11':
      return (
        <svg
          className="w-4 h-4 text-sky-500 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>{osInfo.name}</title>
          {/* Windows 11 Modern Grid */}
          <path d="M2.5 3.5h8.5v8.5H2.5zm10.5 0H21.5v8.5H13zm-10.5 10.5h8.5v8.5H2.5zm10.5 0H21.5v8.5H13z" />
        </svg>
      );
    case 'win10':
      return (
        <svg
          className="w-4 h-4 text-sky-400 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>{osInfo.name}</title>
          {/* Windows 10 Tilted Grid */}
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
        </svg>
      );
    case 'winserver':
      return (
        <div className="relative flex items-center justify-center shrink-0" title={osInfo.name}>
          <Server className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        </div>
      );
    case 'linux':
      return (
        <svg
          className="w-4 h-4 text-amber-500 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>{osInfo.name}</title>
          <path d="M12 2C9.5 2 7.5 3.8 7.5 6c0 1.2.6 2.3 1.5 3-.1.4-.2.9-.2 1.4 0 1.5.5 2.8 1.4 3.8-.7.8-1.7 1.4-2.7 1.8-.8.3-1.5.9-1.5 1.8 0 1.2 1.3 2.2 4 2.2 1.3 0 2.5-.2 3.5-.6 1 .4 2.2.6 3.5.6 2.7 0 4-1 4-2.2 0-.9-.7-1.5-1.5-1.8-1-.4-2-1-2.7-1.8.9-1 1.4-2.3 1.4-3.8 0-.5-.1-1-.2-1.4.9-.7 1.5-1.8 1.5-3 0-2.2-2-4-4.5-4h-3.8z" />
        </svg>
      );
    case 'mac':
      return (
        <svg
          className="w-4 h-4 text-neutral-400 dark:text-neutral-300 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>{osInfo.name}</title>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.38-.58.66-1.09 1.74-.96 2.78 1.05.08 2.09-.54 2.71-1.29z" />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4 text-sky-500 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <title>{osInfo.name}</title>
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
        </svg>
      );
  }
}



export const MachineCard: React.FC<MachineCardProps> = React.memo(
  ({ machine, onSelect, onDelete }) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteMachineMutation = useDeleteMachine();

    const isAlertState = machine.status === 'alerta';
    const isOnline =
      machine.status === 'online' ||
      isAlertState ||
      (machine.last_seen ? Date.now() - new Date(machine.last_seen).getTime() < 5 * 60 * 1000 : false);

    const offlineMinutes =
      !isOnline && machine.last_seen
        ? Math.floor((Date.now() - new Date(machine.last_seen).getTime()) / 60000)
        : 0;
    const isOfflineLongAlert = !isOnline && offlineMinutes >= 30;

    const SEVEN_DAYS_SECONDS = 7 * 24 * 3600;

    const cpuPct = machine.cpu_usage != null ? Math.round(machine.cpu_usage) : null;
    const ramPct = pct(machine.ram_used, machine.ram_total);
    const diskPct = pct(machine.disk_used, machine.disk_total);

    const hasNoAntivirus =
      !machine.security_info?.antivirus ||
      machine.security_info.antivirus.length === 0 ||
      !machine.security_info.antivirus.some((a) => a.active);

    // hasDiskAlert já usa o mesmo limiar de 90% que o backend usa para gerar
    // o alerta oficial de disco (handler/mon_handlers.go) — antes havia um
    // segundo limiar aqui (85%) que fazia o card mostrar "Pouco
    // Armazenamento" numa faixa em que a tela de Alertas não mostrava nada,
    // as duas fontes de verdade divergindo silenciosamente.
    const hasLowStorage = hasDiskAlert(machine);
    const hasHighUptime = (machine.uptime ?? 0) >= SEVEN_DAYS_SECONDS;

    const alerting = hasNoAntivirus || hasLowStorage || hasHighUptime || isOfflineLongAlert;

    const lastSeen = machine.last_seen
      ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR })
      : '–';

    const getMetricColor = (val: number | null) => {
      if (!isOnline || val == null) return 'text-muted-foreground';
      if (val > 85) return 'text-destructive';
      if (val >= 70) return 'text-warning';
      return 'text-success';
    };

    const getProgressBg = (val: number | null) => {
      if (!isOnline || val == null) return 'bg-muted-foreground/20';
      if (val > 85) return 'bg-destructive';
      if (val >= 70) return 'bg-warning';
      return 'bg-success';
    };

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDeleting(true);
      try {
        if (onDelete) {
          await onDelete(machine);
        } else {
          await deleteMachineMutation.mutateAsync(machine.id);
          toast.success(`Máquina ${machine.hostname} excluída com sucesso`);
        }
        setShowDeleteDialog(false);
      } catch (err: any) {
        toast.error('Erro ao excluir máquina: ' + (err.message || 'Falha na requisição'));
      } finally {
        setIsDeleting(false);
      }
    };

    const osInfo = parseOsInfo(machine.os, machine.os_version);

    return (
      <>
        <Card
          role="button"
          tabIndex={0}
          aria-label={`Máquina ${machine.hostname}, Status ${isOnline ? 'Online' : 'Offline'}, CPU ${cpuPct != null ? Math.round(cpuPct) : 0}%, RAM ${ramPct != null ? Math.round(ramPct) : 0}%`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(machine, 'overview');
            }
          }}
          onClick={() => onSelect(machine, 'overview')}
          className={cn(
            'group cursor-pointer transition-all duration-200 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'bg-card/90 hover:bg-card border rounded-lg shadow-sm hover:shadow-md',
            'flex flex-col justify-between hover:border-foreground/20 dark:hover:border-primary/40',
            alerting
              ? 'border-amber-500/40 shadow-amber-500/5'
              : isOnline
              ? 'border-border/60 hover:border-emerald-500/40'
              : 'border-border/40 opacity-80 hover:opacity-100'
          )}
        >
          <CardContent className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
            {/* Header: Identity & Status */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                {/* Left: Device icon, Hostname, Active User & IP */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/40 shrink-0 flex items-center justify-center text-foreground/80 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                    <OsIcon os={machine.os} osVersion={machine.os_version} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3
                        className="font-bold text-[14px] text-foreground truncate tracking-tight group-hover:text-primary transition-colors leading-tight"
                        title={`${machine.hostname} (${osInfo.name})`}
                      >
                        {machine.hostname}
                      </h3>
                      <span className="text-[10px] font-semibold text-muted-foreground/80 font-mono shrink-0">
                        {osInfo.shortLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 font-medium truncate">
                      <span className="truncate text-foreground/80" title={machine.current_user || 'Sem usuário ativo'}>
                        {machine.current_user || '–'}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0" title={machine.ip_address || 'Sem IP'}>
                        {machine.ip_address || '–'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Clean Status Badge */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0',
                      isOnline
                        ? alerting
                          ? 'bg-warning/15 text-warning border border-warning/30'
                          : 'bg-success/15 text-success border border-success/30'
                        : 'bg-muted/40 text-muted-foreground border border-border/40'
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        isOnline
                          ? alerting
                            ? 'bg-warning'
                            : 'bg-success'
                          : 'bg-muted-foreground'
                      )}
                    />
                    <span>
                      {isOnline
                        ? alerting
                          ? 'Alerta'
                          : 'Online'
                        : offlineMinutes >= 30
                        ? `Offline ${
                            Math.floor(offlineMinutes / 60) > 0
                              ? `${Math.floor(offlineMinutes / 60)}h`
                              : `${offlineMinutes}m`
                          }`
                        : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Micro-Badges for Active Alerts */}
              {(hasNoAntivirus || hasLowStorage || hasHighUptime) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {hasNoAntivirus && (
                    <span
                      className="inline-flex items-center gap-1 text-2xs font-medium text-destructive bg-destructive/15 border border-destructive/30 px-2 py-0.5 rounded-md"
                      title="Nenhum antivírus ativo detectado"
                    >
                      <ShieldAlert className="w-3 h-3 text-destructive shrink-0" />
                      <span>Sem Antivírus</span>
                    </span>
                  )}
                  {hasLowStorage && (
                    <span
                      className="inline-flex items-center gap-1 text-2xs font-medium text-warning bg-warning/15 border border-warning/30 px-2 py-0.5 rounded-md"
                      title={`Armazenamento principal com ${diskPct}% ocupado`}
                    >
                      <HardDrive className="w-3 h-3 text-warning shrink-0" />
                      <span>Disco {diskPct}%</span>
                    </span>
                  )}
                  {hasHighUptime && (
                    <span
                      className="inline-flex items-center gap-1 text-2xs font-medium text-warning bg-warning/15 border border-warning/30 px-2 py-0.5 rounded-md"
                      title={`Sistema ligado continuamente há ${formatUptime(machine.uptime)} sem reiniciar`}
                    >
                      <Clock className="w-3 h-3 text-warning shrink-0" />
                      <span>&gt;7d ligado</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Metrics Matrix: 3 Balanced Resource Panels */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              {/* 1. CPU */}
              <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/30 flex flex-col justify-between gap-1.5 group-hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>CPU</span>
                  <span className={cn('font-mono font-bold text-xs', getMetricColor(cpuPct))}>
                    {isOnline && cpuPct != null ? `${cpuPct}%` : '–'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted-foreground/15 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getProgressBg(cpuPct))}
                    style={{ width: `${isOnline && cpuPct != null ? cpuPct : 0}%` }}
                  />
                </div>
                <span className="text-[9.5px] font-mono text-muted-foreground/70 truncate block">
                  {isOnline && cpuPct != null ? (cpuPct > 80 ? 'Carga Alta' : 'Estável') : '–'}
                </span>
              </div>

              {/* 2. RAM */}
              <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/30 flex flex-col justify-between gap-1.5 group-hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>RAM</span>
                  <span className={cn('font-mono font-bold text-xs', getMetricColor(ramPct))}>
                    {isOnline && ramPct != null ? `${ramPct}%` : '–'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted-foreground/15 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getProgressBg(ramPct))}
                    style={{ width: `${isOnline && ramPct != null ? ramPct : 0}%` }}
                  />
                </div>
                <span
                  className="text-[9.5px] font-mono text-muted-foreground/70 truncate block"
                  title={machine.ram_used && machine.ram_total ? `${formatBytes(machine.ram_used)} / ${formatBytes(machine.ram_total)}` : undefined}
                >
                  {isOnline && machine.ram_used && machine.ram_total
                    ? `${formatBytes(machine.ram_used)} / ${formatBytes(machine.ram_total)}`
                    : '–'}
                </span>
              </div>

              {/* 3. DISCO */}
              <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/30 flex flex-col justify-between gap-1.5 group-hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Disco</span>
                  <span className={cn('font-mono font-bold text-xs', getMetricColor(diskPct))}>
                    {isOnline && diskPct != null ? `${diskPct}%` : '–'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted-foreground/15 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getProgressBg(diskPct))}
                    style={{ width: `${isOnline && diskPct != null ? diskPct : 0}%` }}
                  />
                </div>
                <span
                  className="text-[9.5px] font-mono text-muted-foreground/70 truncate block"
                  title={machine.disk_used && machine.disk_total ? `${formatBytes(machine.disk_used)} / ${formatBytes(machine.disk_total)}` : undefined}
                >
                  {isOnline && machine.disk_used && machine.disk_total
                    ? `${formatBytes(machine.disk_used)} / ${formatBytes(machine.disk_total)}`
                    : '–'}
                </span>
              </div>
            </div>

            {/* Footer with Uptime, Last Seen and Delete Action */}
            <div className="pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div
                className="flex items-center gap-1.5 min-w-0 text-[11px]"
                title={isOnline && machine.uptime ? `Tempo de atividade: ${formatUptime(machine.uptime)} • Último sync: ${lastSeen}` : `Visto por último: ${lastSeen}`}
              >
                <Clock className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/60" />
                {isOnline && machine.uptime ? (
                  <span className="truncate">
                    <strong className="font-mono text-foreground/90 font-medium">{formatUptime(machine.uptime)}</strong>
                    <span className="mx-1.5 opacity-30">•</span>
                    <span>{lastSeen}</span>
                  </span>
                ) : (
                  <span className="truncate">Visto {lastSeen}</span>
                )}
                {machine.agent_version && (
                  <span className="text-[10px] opacity-40 font-mono shrink-0 ml-1">
                    v{machine.agent_version}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  title="Excluir registro da máquina"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg sm:max-w-md"
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Excluir Registro da Máquina
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
                <span>
                  Tem certeza de que deseja remover a máquina{' '}
                  <strong className="text-foreground">{machine.hostname}</strong>{' '}
                  ({machine.ip_address || 'sem IP'})?
                </span>
                <span className="block text-xs opacity-80">
                  Esta ação removerá os registros de métricas, hardware, alertas e comandos associados a este dispositivo.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel
                disabled={isDeleting}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(false);
                }}
                className="rounded-xl font-bold"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

MachineCard.displayName = 'MachineCard';

export const MachineCardSkeleton: React.FC = () => (
  <Card className="border rounded-lg bg-card/80 shadow-sm">
    <CardContent className="p-4 space-y-3.5">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full shrink-0" />
      </div>

      {/* Metrics 3-column skeleton */}
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      {/* Footer skeleton */}
      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-6 w-6 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);
