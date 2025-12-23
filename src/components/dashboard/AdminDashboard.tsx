import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Loader2, AlertTriangle, CheckCircle2, Clock, FolderOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

// Paleta de cores para os gráficos
const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const STATUS_COLORS: Record<string, string> = {
  'Aberto': 'hsl(var(--chart-1))',
  'Em Progresso': 'hsl(var(--chart-2))',
  'Resolvido': 'hsl(var(--chart-3))',
  'Fechado': 'hsl(var(--muted-foreground))',
  'Reaberto': 'hsl(var(--destructive))',
};

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon, variant = 'default' }) => {
  const variantStyles = {
    default: 'bg-card',
    warning: 'bg-destructive/10 border-destructive/20',
    success: 'bg-green-500/10 border-green-500/20',
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all hover:shadow-md`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AdminDashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Erro ao carregar estatísticas</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { kpis, by_department, by_status, daily_volume } = stats;

  const formatHours = (hours: number | null) => {
    if (hours === null || isNaN(hours)) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Chamados Abertos"
          value={kpis.open_tickets || 0}
          icon={<FolderOpen className="h-6 w-6 text-primary" />}
        />
        <KPICard
          title="Resolvidos Hoje"
          value={kpis.resolved_today || 0}
          icon={<CheckCircle2 className="h-6 w-6 text-green-500" />}
          variant="success"
        />
        <KPICard
          title="Tempo Médio Resolução"
          value={formatHours(kpis.avg_resolution_hours)}
          icon={<Clock className="h-6 w-6 text-primary" />}
        />
        <KPICard
          title="SLA Violado"
          value={kpis.sla_violated || 0}
          icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
          variant={kpis.sla_violated > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Chamados por Departamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            {by_department.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={by_department} layout="vertical">
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Chamados por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={by_status}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  >
                    {by_status.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Linha - Volume últimos 7 dias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Volume de Chamados (Últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {daily_volume.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily_volume}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="opened" 
                  name="Abertos"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="resolved" 
                  name="Resolvidos"
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-3))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
