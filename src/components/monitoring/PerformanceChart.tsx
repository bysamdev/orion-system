import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Info, Cpu, Layers, HardDrive, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMachineMetricsByPeriod, pct } from '@/hooks/useMonitoring';
import type { MetricPeriod, MachineWithMetric } from '@/hooks/useMonitoring';

export type MetricType = 'all' | 'cpu' | 'ram' | 'disk';

const PERIODS: MetricPeriod[] = ['1h', '6h', '24h', '7d'];

const METRIC_TABS: { key: MetricType; label: string; icon: any; color: string }[] = [
  { key: 'all', label: 'Todos', icon: Activity, color: 'text-primary' },
  { key: 'cpu', label: 'CPU', icon: Cpu, color: 'text-indigo-500' },
  { key: 'ram', label: 'RAM', icon: Layers, color: 'text-emerald-500' },
  { key: 'disk', label: 'Disco', icon: HardDrive, color: 'text-amber-500' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2.5 shadow-2xl text-[11px] space-y-1.5 min-w-[130px]">
      <p className="font-bold text-muted-foreground border-b border-border/40 pb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || p.stroke }} />
            <span className="text-muted-foreground font-medium">{p.name || p.dataKey}:</span>
          </div>
          <span className="font-black font-mono text-foreground">{p.value != null ? `${p.value}%` : '–'}</span>
        </div>
      ))}
    </div>
  );
};

export interface PerformanceChartProps {
  machineId: string | null;
  machine?: MachineWithMetric | null;
  period: MetricPeriod;
  onPeriodChange: (p: MetricPeriod) => void;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
  title?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  machineId,
  machine: _machine,
  period,
  onPeriodChange,
  selectedMetric: controlledMetric,
  onMetricChange,
  title = 'Performance Histórica Nativa',
}) => {
  const [internalMetric, setInternalMetric] = useState<MetricType>('all');
  const activeMetric = controlledMetric ?? internalMetric;

  const handleMetricSelect = (m: MetricType) => {
    if (onMetricChange) {
      onMetricChange(m);
    } else {
      setInternalMetric(m);
    }
  };

  const { data: metrics = [], isLoading } = useMachineMetricsByPeriod(machineId, period);

  const chartData = metrics
    .slice()
    .reverse()
    .map((m) => ({
      time: format(new Date(m.collected_at), period === '7d' ? 'dd/MM HH:mm' : 'HH:mm'),
      CPU: m.cpu_usage != null ? Math.round(m.cpu_usage) : null,
      RAM: pct(m.ram_used, m.ram_total),
      Disco: pct(m.disk_used, m.disk_total),
    }));

  // Quick statistics calculation
  const getStats = (key: 'CPU' | 'RAM' | 'Disco') => {
    const values = chartData.map((d) => d[key]).filter((v): v is number => v != null);
    if (values.length === 0) return { current: null, avg: null, max: null, min: null };
    const current = values[values.length - 1];
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { current, avg, max, min };
  };

  const cpuStats = getStats('CPU');
  const ramStats = getStats('RAM');
  const diskStats = getStats('Disco');

  return (
    <Card className="p-4 border-border/40 bg-card/60 backdrop-blur-sm space-y-4 shadow-sm">
      {/* Header with Title, Period Selector & Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-border/30">
        <div>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-primary" />
            {title}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Amostragem em tempo real consolidada via Orion Agent
          </p>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/30 self-start sm:self-auto">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all',
                period === p
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {METRIC_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeMetric === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleMetricSelect(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                  isSelected
                    ? 'bg-muted/80 text-foreground border-primary/40 shadow-sm'
                    : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/30 hover:text-foreground'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isSelected ? tab.color : 'opacity-70')} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Metric Stats Pill */}
        {chartData.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {activeMetric === 'cpu' && cpuStats.current != null && (
              <span className="font-mono">
                Atual: <strong className="text-foreground">{cpuStats.current}%</strong> | Média:{' '}
                <strong className="text-foreground">{cpuStats.avg}%</strong> | Pico:{' '}
                <strong className="text-red-500">{cpuStats.max}%</strong>
              </span>
            )}
            {activeMetric === 'ram' && ramStats.current != null && (
              <span className="font-mono">
                Atual: <strong className="text-foreground">{ramStats.current}%</strong> | Média:{' '}
                <strong className="text-foreground">{ramStats.avg}%</strong> | Pico:{' '}
                <strong className="text-red-500">{ramStats.max}%</strong>
              </span>
            )}
            {activeMetric === 'disk' && diskStats.current != null && (
              <span className="font-mono">
                Atual: <strong className="text-foreground">{diskStats.current}%</strong> | Média:{' '}
                <strong className="text-foreground">{diskStats.avg}%</strong> | Pico:{' '}
                <strong className="text-amber-500">{diskStats.max}%</strong>
              </span>
            )}
            {activeMetric === 'all' && (
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">
                {chartData.length} pontos registrados
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      {isLoading ? (
        <Skeleton className="h-60 w-full rounded-xl" />
      ) : chartData.length === 0 ? (
        <div className="h-60 flex flex-col items-center justify-center text-muted-foreground gap-2.5 bg-muted/10 rounded-xl border border-dashed border-border/40">
          <Info className="w-8 h-8 opacity-30 text-muted-foreground" />
          <p className="text-xs font-medium">Sem dados históricos de telemetria para o período selecionado ({period}).</p>
          <span className="text-[10px] opacity-70">O agente enviará novos pontos de métricas a cada ciclo.</span>
        </div>
      ) : (
        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeMetric === 'all' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => (
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="CPU"
                  name="CPU (%)"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="RAM"
                  name="RAM (%)"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="Disco"
                  name="Disco (%)"
                  stroke="rgb(245, 158, 11)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={true}
                />
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(99, 102, 241)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="rgb(99, 102, 241)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(16, 185, 129)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="rgb(16, 185, 129)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(245, 158, 11)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="rgb(245, 158, 11)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {activeMetric === 'cpu' && (
                  <Area
                    type="monotone"
                    dataKey="CPU"
                    name="Uso de CPU"
                    stroke="rgb(99, 102, 241)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCpu)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                )}
                {activeMetric === 'ram' && (
                  <Area
                    type="monotone"
                    dataKey="RAM"
                    name="Uso de RAM"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRam)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                )}
                {activeMetric === 'disk' && (
                  <Area
                    type="monotone"
                    dataKey="Disco"
                    name="Uso de Disco"
                    stroke="rgb(245, 158, 11)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDisk)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
