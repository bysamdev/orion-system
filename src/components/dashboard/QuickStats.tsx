import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Clock, CheckCircle, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { useActiveOperators, useGlobalTicketStats } from '@/hooks/useStats';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, subtitle, trend, isLoading }) => {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="text-muted-foreground text-xs font-medium flex items-center gap-1">
            {icon}
            {title}
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
            {subtitle && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
            {trend && (
              <div className="text-xs text-success font-medium mt-1">{trend}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const QuickStats: React.FC = () => {
  const { data: operatorsCount, isLoading: loadingOperators } = useActiveOperators();
  const { data: stats, isLoading: loadingStats } = useGlobalTicketStats();

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="space-y-3">
      <StatCard
        icon={<Users className="w-3 h-3" />}
        title="Operadores Ativos"
        value={operatorsCount || 0}
        isLoading={loadingOperators}
      />
      
      <StatCard
        icon={<Activity className="w-3 h-3" />}
        title="Em Andamento"
        value={stats?.inProgress || 0}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<CheckCircle className="w-3 h-3" />}
        title="Resolvidos Hoje"
        value={stats?.resolvedToday || 0}
        subtitle={`${stats?.slaComplianceToday || 0}% SLA`}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<TrendingUp className="w-3 h-3" />}
        title="Tickets Abertos"
        value={stats?.openTickets || 0}
        trend={stats?.openedToday ? `+${stats.openedToday} hoje` : undefined}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<Clock className="w-3 h-3" />}
        title="Tempo Médio de Resposta"
        value={stats ? formatHours(stats.avgResponseTime) : '0h'}
        subtitle={`${stats?.slaOverall || 0}% dentro do SLA`}
        isLoading={loadingStats}
      />
    </div>
  );
};
