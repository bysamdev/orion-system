import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Wifi, WifiOff, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MachineWithMetric } from '@/hooks/useMonitoring';
import { pct, hasDiskAlert } from '@/hooks/useMonitoring';

interface MachineCardProps {
  machine: MachineWithMetric;
  onClick: () => void;
}

function StatusDot({ status, hasAlert }: { status: string; hasAlert: boolean }) {
  if (hasAlert) return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
    </span>
  );
  if (status === 'online') return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
  );
  return <span className="inline-flex rounded-full h-3 w-3 bg-red-500" />;
}

function MetricBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={cn('font-medium', colorClass ?? '')}>{value}%</span>
      </div>
      <Progress
        value={value}
        className={cn(
          'h-1.5',
          value > 90
            ? '[&>div]:bg-red-500'
            : value > 75
            ? '[&>div]:bg-yellow-500'
            : '[&>div]:bg-green-500'
        )}
      />
    </div>
  );
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, onClick }) => {
  const alerting = hasDiskAlert(machine);
  const isOnline = machine.status === 'online';

  const cpuPct = machine.cpu_usage != null ? Math.round(machine.cpu_usage) : null;
  const ramPct = pct(machine.ram_used, machine.ram_total);
  const diskPct = pct(machine.disk_used, machine.disk_total);

  const lastSeen = machine.last_seen
    ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR })
    : '–';

  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border',
        alerting
          ? 'border-yellow-500/40 bg-yellow-500/5'
          : isOnline
          ? 'border-green-500/20 hover:border-green-500/40'
          : 'border-red-500/20 opacity-80 hover:border-red-500/40'
      )}
    >
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={machine.status} hasAlert={alerting} />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate" title={machine.hostname}>
                {machine.hostname}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {machine.ip_address || '–'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {alerting && (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0.5',
                isOnline
                  ? 'text-green-600 border-green-500/30 bg-green-500/10'
                  : 'text-red-600 border-red-500/30 bg-red-500/10'
              )}
            >
              {isOnline ? (
                <><Wifi className="w-2.5 h-2.5 mr-0.5" />Online</>
              ) : (
                <><WifiOff className="w-2.5 h-2.5 mr-0.5" />Offline</>
              )}
            </Badge>
          </div>
        </div>

        {/* OS */}
        {machine.os && (
          <p className="text-xs text-muted-foreground truncate">
            {machine.os} {machine.os_version}
          </p>
        )}

        {/* Metrics */}
        {isOnline && cpuPct != null ? (
          <div className="space-y-2">
            <MetricBar label="CPU" value={cpuPct} />
            <MetricBar label="RAM" value={ramPct} />
            <MetricBar label="Disco" value={diskPct} />
          </div>
        ) : (
          <div className="space-y-2 opacity-40">
            <MetricBar label="CPU" value={0} />
            <MetricBar label="RAM" value={0} />
            <MetricBar label="Disco" value={0} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border">
          <Clock className="w-3 h-3" />
          <span>{lastSeen}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export const MachineCardSkeleton: React.FC = () => (
  <Card>
    <CardContent className="pt-4 pb-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <Skeleton className="h-3 w-1/3" />
    </CardContent>
  </Card>
);
