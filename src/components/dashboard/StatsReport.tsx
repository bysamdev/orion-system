import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportData {
  period: string;
  opened: number;
  solved: number;
  average: string;
  trend: 'up' | 'down';
}

const dailyData: ReportData = {
  period: 'Hoje',
  opened: 12,
  solved: 8,
  average: '2.5h',
  trend: 'up'
};

const weeklyData: ReportData = {
  period: 'Esta Semana',
  opened: 47,
  solved: 41,
  average: '3.2h',
  trend: 'down'
};

export const StatsReport: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const data = period === 'daily' ? dailyData : weeklyData;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Relatório de Chamados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'daily' | 'weekly')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="daily">Diário</TabsTrigger>
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="space-y-4">
            <ReportContent data={data} />
          </TabsContent>
          
          <TabsContent value="weekly" className="space-y-4">
            <ReportContent data={data} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ReportContent: React.FC<{ data: ReportData }> = ({ data }) => {
  const solvedPercentage = (data.solved / data.opened * 100).toFixed(0);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-primary/10">
          <p className="text-xs text-muted-foreground mb-1">Abertos</p>
          <p className="text-2xl font-bold text-foreground">{data.opened}</p>
        </div>
        
        <div className="p-4 rounded-lg bg-success/10">
          <p className="text-xs text-muted-foreground mb-1">Solucionados</p>
          <p className="text-2xl font-bold text-foreground">{data.solved}</p>
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-muted">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Taxa de Solução</p>
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            data.trend === 'up' ? 'text-success' : 'text-destructive'
          )}>
            {data.trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {solvedPercentage}%
          </div>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div 
            className="bg-success h-2 rounded-full transition-all"
            style={{ width: `${solvedPercentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-accent/10 border border-accent">
        <p className="text-xs text-muted-foreground mb-1">Tempo Médio de Resposta</p>
        <p className="text-xl font-bold text-foreground">{data.average}</p>
      </div>
    </div>
  );
};
