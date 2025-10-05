import React from 'react';
import { Clock, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCard {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
}

const stats: StatCard[] = [
  { title: 'Tickets Abertos', value: '12', icon: Clock, trend: '+3 hoje' },
  { title: 'Em Andamento', value: '5', icon: TrendingUp },
  { title: 'Operadores Ativos', value: '3', icon: Users },
  { title: 'Resolvidos Hoje', value: '8', icon: CheckCircle2, trend: '80% SLA' },
];

export const RightSidebar: React.FC = () => {
  return (
    <aside className="w-80 space-y-4 hidden lg:block">
      {stats.map((stat, index) => (
        <Card key={index} className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <stat.icon className="w-4 h-4 text-primary" />
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stat.value}</div>
            {stat.trend && (
              <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
            )}
          </CardContent>
        </Card>
      ))}
      
      <Card className="border-border shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tempo Médio de Resposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">2.5h</div>
          <div className="w-full bg-secondary rounded-full h-2 mt-3">
            <div className="bg-primary h-2 rounded-full w-3/4 transition-all"></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">75% dentro do SLA</p>
        </CardContent>
      </Card>
    </aside>
  );
};
