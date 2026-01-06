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
    <Card className="border-border shadow-sm min-w-0">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-muted-foreground flex-shrink-0">{icon}</div>
          <span className="text-muted-foreground text-xs font-medium truncate">{title}</span>
        </div>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground">{value}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">{subtitle}</span>
            )}
            {trend && (
              <span className="text-xs text-success font-medium whitespace-nowrap">{trend}</span>
            )}
          </div>
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
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    return `${(hours / 24).toFixed(1)}d`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      <StatCard
        icon={<Users className="w-4 h-4" />}
        title="Operadores"
        value={operatorsCount || 0}
        isLoading={loadingOperators}
      />
      
      <StatCard
        icon={<Activity className="w-4 h-4" />}
        title="Em Andamento"
        value={stats?.inProgress || 0}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<CheckCircle className="w-4 h-4" />}
        title="Resolvidos Hoje"
        value={stats?.resolvedToday || 0}
        subtitle={`${stats?.slaComplianceToday || 0}% SLA`}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<TrendingUp className="w-4 h-4" />}
        title="Abertos"
        value={stats?.openTickets || 0}
        trend={stats?.openedToday ? `+${stats.openedToday} hoje` : undefined}
        isLoading={loadingStats}
      />
      
      <StatCard
        icon={<Clock className="w-4 h-4" />}
        title="Tempo Médio"
        value={stats ? formatHours(stats.avgResponseTime) : '0h'}
        subtitle={`${stats?.slaOverall || 0}% SLA`}
        isLoading={loadingStats}
      />
    </div>
  );
};
