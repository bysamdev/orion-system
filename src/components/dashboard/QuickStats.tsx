import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Clock, CheckCircle, TrendingUp, Activity } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, subtitle, trend }) => {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="text-muted-foreground text-xs font-medium flex items-center gap-1">
            {icon}
            {title}
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
        {trend && (
          <div className="text-xs text-success font-medium mt-1">{trend}</div>
        )}
      </CardContent>
    </Card>
  );
};

export const QuickStats: React.FC = () => {
  return (
    <div className="space-y-3">
      <StatCard
        icon={<Users className="w-3 h-3" />}
        title="Operadores Ativos"
        value="3"
      />
      
      <StatCard
        icon={<Activity className="w-3 h-3" />}
        title="Em Andamento"
        value="5"
      />
      
      <StatCard
        icon={<CheckCircle className="w-3 h-3" />}
        title="Resolvidos Hoje"
        value="8"
        subtitle="80% SLA"
      />
      
      <StatCard
        icon={<TrendingUp className="w-3 h-3" />}
        title="Tickets Abertos"
        value="12"
        trend="+3 hoje"
      />
      
      <StatCard
        icon={<Clock className="w-3 h-3" />}
        title="Tempo Médio de Resposta"
        value="2.5h"
        subtitle="75% dentro do SLA"
      />
    </div>
  );
};
