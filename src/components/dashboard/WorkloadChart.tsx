import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface WorkloadSlice {
  name: string;
  value: number;
  color: string;
}

interface WorkloadChartProps {
  workload: WorkloadSlice[];
}

// Isolado do TechnicianDashboard para que o bundle do `recharts` só
// seja baixado quando este gráfico realmente for renderizado
// (React.lazy no componente pai), em vez de entrar no chunk padrão
// que todo usuário autenticado carrega ao abrir o dashboard.
export default function WorkloadChart({ workload }: WorkloadChartProps) {
  return (
    <div className="h-[240px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={workload} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
            {workload.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />)}
          </Pie>
          <RechartsTooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', fontSize: '12px' }}
            itemStyle={{ fontWeight: 'bold' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-black tracking-tighter">{workload.reduce((a, b) => a + b.value, 0)}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Tickets</span>
      </div>
    </div>
  );
}
