import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, HardDrive, Cpu, Monitor } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useMachineDetail,
  useMachineMetrics,
  useMachineAlerts,
  pct,
} from '@/hooks/useMonitoring';
import type { MachineWithMetric } from '@/hooks/useMonitoring';
import { cn } from '@/lib/utils';

interface MachineDrawerProps {
  machine: MachineWithMetric | null;
  open: boolean;
  onClose: () => void;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

function bytes(n: number | null): string {
  if (!n) return '–';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${n} B`;
}

function InfoRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground text-right max-w-[60%] truncate">
        {value ?? '–'}
      </span>
    </div>
  );
}

export const MachineDrawer: React.FC<MachineDrawerProps> = ({ machine, open, onClose }) => {
  const machineId = machine?.id ?? null;

  const { data: detail, isLoading: detailLoading } = useMachineDetail(machineId);
  const { data: metrics = [], isLoading: metricsLoading } = useMachineMetrics(machineId, 288); // 24h x 5min
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);

  const hw = detail?.hardware;

  // Build chart data — last 24h
  const chartData = metrics
    .slice()
    .reverse()
    .map((m) => ({
      time: format(new Date(m.collected_at), 'HH:mm'),
      CPU: m.cpu_usage != null ? Math.round(m.cpu_usage) : null,
      RAM: pct(m.ram_used, m.ram_total),
    }));

  const isOnline = machine?.status === 'online';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-3 w-3 rounded-full flex-shrink-0',
              isOnline ? 'bg-green-500' : 'bg-red-500'
            )} />
            <div>
              <SheetTitle className="text-left">{machine?.hostname ?? '–'}</SheetTitle>
              <SheetDescription className="text-left">
                {machine?.ip_address} · {machine?.os} {machine?.os_version}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">

            {/* ── Status geral ── */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Status
              </h3>
              <div className="divide-y divide-border rounded-lg border border-border bg-muted/30 px-3">
                <InfoRow label="Última vez visto" value={
                  machine?.last_seen
                    ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR })
                    : '–'
                } />
                <InfoRow label="Versão do agente" value={machine?.agent_version} />
                <InfoRow label="Uptime" value={
                  machine?.uptime
                    ? `${Math.floor(machine.uptime / 3600)}h ${Math.floor((machine.uptime % 3600) / 60)}m`
                    : '–'
                } />
                <InfoRow label="CPU" value={
                  machine?.cpu_usage != null ? `${Math.round(machine.cpu_usage)}%` : '–'
                } />
                <InfoRow label="RAM" value={
                  `${bytes(machine?.ram_used ?? null)} / ${bytes(machine?.ram_total ?? null)} (${pct(machine?.ram_used ?? null, machine?.ram_total ?? null)}%)`
                } />
                <InfoRow label="Disco" value={
                  `${bytes(machine?.disk_used ?? null)} / ${bytes(machine?.disk_total ?? null)} (${pct(machine?.disk_used ?? null, machine?.disk_total ?? null)}%)`
                } />
              </div>
            </section>

            {/* ── Hardware ── */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Hardware
              </h3>
              {detailLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border bg-muted/30 px-3">
                  <InfoRow
                    label={<span className="flex items-center gap-1"><Cpu className="w-3 h-3" />CPU</span>}
                    value={hw?.cpu_model}
                  />
                  <InfoRow
                    label={<span className="flex items-center gap-1"><Monitor className="w-3 h-3" />GPU</span>}
                    value={hw?.gpu}
                  />
                  <InfoRow
                    label={<span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />Discos</span>}
                    value={
                      Array.isArray(hw?.disks) && hw.disks.length > 0
                        ? `${hw.disks.length} disco(s)`
                        : '–'
                    }
                  />
                </div>
              )}
            </section>

            <Separator />

            {/* ── Gráfico CPU/RAM ── */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Histórico CPU & RAM (últimas 24h)
              </h3>
              {metricsLoading ? (
                <Skeleton className="h-40 w-full rounded-lg" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma métrica registrada.
                </p>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`${v}%`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="CPU"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="RAM"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <Separator />

            {/* ── Alertas ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Alertas Ativos
                </h3>
                {alerts.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {alerts.length}
                  </Badge>
                )}
              </div>
              {alertsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm py-3">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Nenhum alerta ativo</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 space-y-1',
                        severityColor[alert.severity] ?? 'bg-muted/40 border-border text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs font-semibold capitalize">{alert.severity}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
