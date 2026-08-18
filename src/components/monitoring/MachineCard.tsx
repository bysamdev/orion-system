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
          title={osInfo.name}
        >
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
          title={osInfo.name}
        >
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
          title={osInfo.name}
        >
          <path d="M12 2C9.5 2 7.5 3.8 7.5 6c0 1.2.6 2.3 1.5 3-.1.4-.2.9-.2 1.4 0 1.5.5 2.8 1.4 3.8-.7.8-1.7 1.4-2.7 1.8-.8.3-1.5.9-1.5 1.8 0 1.2 1.3 2.2 4 2.2 1.3 0 2.5-.2 3.5-.6 1 .4 2.2.6 3.5.6 2.7 0 4-1 4-2.2 0-.9-.7-1.5-1.5-1.8-1-.4-2-1-2.7-1.8.9-1 1.4-2.3 1.4-3.8 0-.5-.1-1-.2-1.4.9-.7 1.5-1.8 1.5-3 0-2.2-2-4-4.5-4h-3.8z" />
        </svg>
      );
    case 'mac':
      return (
        <svg
          className="w-4 h-4 text-neutral-400 dark:text-neutral-300 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          title={osInfo.name}
        >
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.38-.58.66-1.09 1.74-.96 2.78 1.05.08 2.09-.54 2.71-1.29z" />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4 text-sky-500 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          title={osInfo.name}
        >
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
        </svg>
      );
  }
}

function StatusDot({ status, hasAlert }: { status: string; hasAlert: boolean }) {
  if (hasAlert) {
    return (
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
      </span>
    );
  }
  if (status === 'online') {
    return (
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full h-2.5 w-2.5 bg-zinc-400 dark:bg-zinc-600 shadow-[0_0_4px_rgba(161,161,170,0.5)] flex-shrink-0" />
  );
}

function MetricBar({
  label,
  value,
  usedBytes,
  totalBytes,
  showBytes = false,
  isOnline = true,
}: {
  label: string;
  value: number | null;
  usedBytes?: number | null;
  totalBytes?: number | null;
  showBytes?: boolean;
  isOnline?: boolean;
}) {
  const safeValue = isOnline && value != null ? Math.min(100, Math.max(0, value)) : 0;

  // Dinâmico: Verde < 70%, Amarelo 70-85%, Vermelho > 85%
  const getProgressColor = (v: number) => {
    if (!isOnline) return 'bg-muted-foreground/30';
    if (v > 85) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
    if (v >= 70) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
    return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
  };

  const getTextColor = (v: number) => {
    if (!isOnline) return 'text-muted-foreground';
    if (v > 85) return 'text-red-500 dark:text-red-400 font-black';
    if (v >= 70) return 'text-amber-500 dark:text-amber-400 font-bold';
    return 'text-emerald-600 dark:text-emerald-400 font-bold';
  };

  const bytesText =
    showBytes && totalBytes && totalBytes > 0
      ? `${formatBytes(usedBytes)} / ${formatBytes(totalBytes)}`
      : null;

  return (
    <div className="space-y-1 group/bar">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground group-hover/bar:text-foreground transition-colors">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {bytesText && isOnline && (
            <span className="text-[10px] text-muted-foreground font-mono font-medium">
              {bytesText}
            </span>
          )}
          <span className={cn('text-[11px] font-mono', getTextColor(safeValue))}>
            {isOnline && value != null ? `${Math.round(safeValue)}%` : '–'}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted/70 dark:bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getProgressColor(safeValue))}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
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

    const hasLowStorage = (diskPct != null && diskPct >= 85) || hasDiskAlert(machine);
    const hasHighUptime = (machine.uptime ?? 0) >= SEVEN_DAYS_SECONDS;

    const alerting = hasNoAntivirus || hasLowStorage || hasHighUptime || isOfflineLongAlert;

    const lastSeen = machine.last_seen
      ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR })
      : '–';

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

    return (
      <>
        <Card
          onClick={() => onSelect(machine, 'overview')}
          className={cn(
            'cursor-pointer transition-all duration-300 transform hover:scale-[1.015] hover:-translate-y-0.5 relative overflow-hidden',
            'glass-card group flex flex-col justify-between border shadow-sm hover:shadow-md',
            alerting
              ? 'border-amber-500/40 shadow-sm shadow-amber-500/10'
              : isOnline
              ? 'border-emerald-500/20 hover:border-emerald-500/40'
              : 'border-border/60 opacity-90 hover:border-border'
          )}
        >
          {/* Subtle top accent gradient */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-[2px] pointer-events-none',
              alerting
                ? 'bg-amber-500'
                : isOnline
                ? 'bg-emerald-500'
                : 'bg-zinc-400 dark:bg-zinc-600'
            )}
          />

          <CardContent className="p-3.5 space-y-3 relative z-10 flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <OsIcon os={machine.os} osVersion={machine.os_version} />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <StatusDot status={machine.status} hasAlert={alerting} />
                    <p
                      className="font-bold text-sm text-foreground truncate tracking-tight"
                      title={`${machine.hostname} (${parseOsInfo(machine.os, machine.os_version).name})`}
                    >
                      {machine.hostname}
                    </p>
                    <span className="text-[10px] font-semibold text-muted-foreground/90 bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
                      {parseOsInfo(machine.os, machine.os_version).shortLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {alerting && (
                    <AlertTriangle
                      className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-pulse"
                      title="Alerta no Dispositivo"
                    />
                  )}

                  {/* Status Badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0 h-5 flex items-center gap-1 shrink-0',
                      isOnline
                        ? alerting
                          ? 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
                          : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-zinc-600 dark:text-zinc-400 border-zinc-400/30 bg-zinc-400/10'
                    )}
                  >
                    {isOnline ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5">
                          <span
                            className={cn(
                              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                              alerting ? 'bg-amber-400' : 'bg-emerald-400'
                            )}
                          />
                          <span
                            className={cn(
                              'relative inline-flex rounded-full h-1.5 w-1.5',
                              alerting ? 'bg-amber-500' : 'bg-emerald-500'
                            )}
                          />
                        </span>
                        {alerting ? 'Online (Alerta)' : 'Online'}
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-2.5 h-2.5 mr-0.5" />
                        {offlineMinutes >= 30
                          ? `Offline há ${
                              Math.floor(offlineMinutes / 60) > 0
                                ? `${Math.floor(offlineMinutes / 60)}h`
                                : `${offlineMinutes}m`
                            }`
                          : 'Offline'}
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              {/* Identificação do Host: Usuário Ativo e IP */}
              <div className="bg-muted/40 dark:bg-muted/20 rounded-md px-2.5 py-1.5 border border-border/30 flex items-center justify-between gap-2 text-xs">
                {/* Usuário Ativo */}
                <div
                  className="flex items-center gap-1.5 min-w-0 flex-1"
                  title={`Usuário Ativo: ${machine.current_user || '–'}`}
                >
                  <User className="w-3.5 h-3.5 text-indigo-500/90 dark:text-indigo-400 shrink-0" />
                  <span className="font-medium text-foreground truncate text-[11.5px]">
                    {machine.current_user || '–'}
                  </span>
                </div>

                {/* IP Interno */}
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  title={`IP Local: ${machine.ip_address || '–'}`}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-500/90 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {machine.ip_address || '–'}
                  </span>
                </div>
              </div>

              {/* Linha de Alertas Rápidos do Card: Sem Antivírus, Pouco Armazenamento, >7 dias sem reiniciar */}
              {(hasNoAntivirus || hasLowStorage || hasHighUptime) && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {/* 1. Sem Antivírus */}
                  {hasNoAntivirus && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 font-bold text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 gap-1 animate-pulse"
                      title="Alerta de Proteção: Nenhum antivírus ativo detectado nesta máquina"
                    >
                      <ShieldAlert className="w-2.5 h-2.5 text-red-500" />
                      Sem Antivírus
                    </Badge>
                  )}

                  {/* 2. Pouco Armazenamento */}
                  {hasLowStorage && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 font-bold text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 gap-1 animate-pulse"
                      title={`Alerta de Armazenamento: Disco principal com ${diskPct}% ocupado`}
                    >
                      <HardDrive className="w-2.5 h-2.5 text-red-500" />
                      Pouco Armazenamento ({diskPct}%)
                    </Badge>
                  )}

                  {/* 3. Mais de 7 dias ligada sem parar */}
                  {hasHighUptime && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1 animate-pulse"
                      title={`Alerta de Uptime: Sistema ligado continuamente há ${formatUptime(machine.uptime)} sem reiniciar`}
                    >
                      <Clock className="w-2.5 h-2.5 text-amber-500" />
                      &gt;7 dias sem reiniciar
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="space-y-1.5 py-1">
              <MetricBar
                label="CPU"
                value={cpuPct}
                isOnline={isOnline}
              />
              <MetricBar
                label="RAM"
                value={ramPct}
                usedBytes={machine.ram_used}
                totalBytes={machine.ram_total}
                showBytes={true}
                isOnline={isOnline}
              />
              <MetricBar
                label="Disco"
                value={diskPct}
                usedBytes={machine.disk_used}
                totalBytes={machine.disk_total}
                showBytes={true}
                isOnline={isOnline}
              />
            </div>

            {/* Footer with Uptime, Last Seen and Delete Action */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-1.5 min-w-0 text-[10.5px] text-muted-foreground"
                title={isOnline && machine.uptime ? `Tempo de atividade: ${formatUptime(machine.uptime)} • Último sync: ${lastSeen}` : `Visto por último: ${lastSeen}`}
              >
                <Clock className="w-3 h-3 flex-shrink-0 text-muted-foreground/70" />
                {isOnline && machine.uptime ? (
                  <>
                    <span className="font-mono font-medium text-foreground/80 shrink-0">
                      {formatUptime(machine.uptime)}
                    </span>
                    <span className="opacity-30 shrink-0">•</span>
                    <span className="truncate">{lastSeen}</span>
                  </>
                ) : (
                  <span className="truncate">{lastSeen}</span>
                )}
                {machine.agent_version && (
                  <span className="text-[10px] opacity-50 font-mono shrink-0 ml-0.5">
                    v{machine.agent_version}
                  </span>
                )}
              </div>

              {/* Action Buttons (Apenas Lixeira com Confirmação) */}
              <div className="flex items-center shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  title="Excluir registro da máquina"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl sm:max-w-md"
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
  <Card className="glass-card border">
    <CardContent className="p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <Skeleton className="h-14 w-full rounded-lg" />

      <div className="space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    </CardContent>
  </Card>
);
