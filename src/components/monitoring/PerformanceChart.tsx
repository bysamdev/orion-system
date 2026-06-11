import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMachineMetricsByPeriod, pct } from '@/hooks/useMonitoring';
import type { MetricPeriod, MachineWithMetric } from '@/hooks/useMonitoring';

const PERIODS: MetricPeriod[] = ['1h', '6h', '24h', '7d'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-[11px] space-y-1">
      <p className="font-bold text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.dataKey}:</span>
          <span className="font-bold text-foreground">{p.value != null ? `${p.value}%` : '–'}</span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  machineId: string | null;
  machine: MachineWithMetric | null;
  period: MetricPeriod;
  onPeriodChange: (p: MetricPeriod) => void;
}

export const PerformanceChart: React.FC<Props> = ({ machineId, machine: _machine, period, onPeriodChange }) => {
  const { data: metrics = [], isLoading } = useMachineMetricsByPeriod(machineId, period);

  const chartData = metrics
    .slice()
    .reverse()
    .map(m => ({
      time: format(new Date(m.collected_at), period === '7d' ? 'dd/MM HH:mm' : 'HH:mm'),
      CPU: m.cpu_usage != null ? Math.round(m.cpu_usage) : null,
      RAM: pct(m.ram_used, m.ram_total),
      Disco: pct(m.disk_used, m.disk_total),
    }));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Desempenho Histórico
        </h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold transition-all border',
                period === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4 border-border/40 bg-background shadow-sm">
        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Info className="w-8 h-8 opacity-20" />
            <p className="text-xs">Sem dados históricos para o período selecionado</p>
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                  formatter={value => <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}>{value}</span>}
                />
                <Line type="monotone" dataKey="CPU" stroke="rgb(99, 102, 241)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="RAM" stroke="rgb(16, 185, 129)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Disco" stroke="rgb(245, 158, 11)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </section>
  );
};
