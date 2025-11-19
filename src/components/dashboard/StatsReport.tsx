import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Activity, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useTicketStats, SLA_TARGETS } from '@/hooks/useStats';

interface ReportData {
  opened: number;
  solved: number;
  average: string;
  slaCompliance: number;
  hasData: boolean;
}

export const StatsReport: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const { data: stats, isLoading } = useTicketStats(period);

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const data: ReportData = {
    opened: stats?.opened || 0,
    solved: stats?.solved || 0,
    average: stats ? formatHours(stats.averageHours) : '0h',
    slaCompliance: stats?.slaCompliance || 0,
    hasData: (stats?.opened || 0) > 0 || (stats?.solved || 0) > 0,
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Relatório de Chamados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Relatório de Chamados
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            SLA: Alta {SLA_TARGETS.high}h | Média {SLA_TARGETS.medium}h | Baixa {SLA_TARGETS.low}h
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'daily' | 'weekly')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted">
            <TabsTrigger value="daily" className="data-[state=active]:bg-background">Diário</TabsTrigger>
            <TabsTrigger value="weekly" className="data-[state=active]:bg-background">Semanal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="space-y-4 mt-4">
            <ReportContent data={data} />
          </TabsContent>
          
          <TabsContent value="weekly" className="space-y-4 mt-4">
            <ReportContent data={data} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ReportContent: React.FC<{ data: ReportData }> = ({ data }) => {
  if (!data.hasData) {
    return (
      <div className="py-12 text-center space-y-3">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Nenhum chamado no período
          </p>
          <p className="text-xs text-muted-foreground">
            Os dados aparecerão assim que houver atividade
          </p>
        </div>
      </div>
    );
  }

  const solvedPercentage = data.opened > 0 ? (data.solved / data.opened * 100).toFixed(0) : '0';
  const solvedPercentageCapped = Math.min(parseFloat(solvedPercentage), 100);
  const slaColor = data.slaCompliance >= 80 ? 'success' : data.slaCompliance >= 60 ? 'warning' : 'destructive';
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Abertos</p>
          <p className="text-3xl font-bold text-foreground">{data.opened}</p>
        </div>
        
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <p className="text-xs text-muted-foreground mb-1">Solucionados</p>
          <p className="text-3xl font-bold text-foreground">{data.solved}</p>
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Taxa de Solução</p>
          <div className="flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="w-3 h-3" />
            {solvedPercentage}%
          </div>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div 
            className="bg-success h-2 rounded-full transition-all duration-500"
            style={{ width: `${solvedPercentageCapped}%` }}
          ></div>
        </div>
      </div>

      {data.slaCompliance > 0 && (
        <div className={`p-4 rounded-lg border ${
          slaColor === 'success' ? 'bg-success/10 border-success/20' :
          slaColor === 'warning' ? 'bg-warning/10 border-warning/20' :
          'bg-destructive/10 border-destructive/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Conformidade SLA</p>
            <Badge 
              variant={slaColor === 'success' ? 'default' : 'secondary'}
              className={
                slaColor === 'success' ? 'bg-success text-success-foreground' :
                slaColor === 'warning' ? 'bg-warning text-warning-foreground' :
                'bg-destructive text-destructive-foreground'
              }
            >
              {data.slaCompliance}%
            </Badge>
          </div>
          <div className="w-full bg-background rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                slaColor === 'success' ? 'bg-success' :
                slaColor === 'warning' ? 'bg-warning' :
                'bg-destructive'
              }`}
              style={{ width: `${data.slaCompliance}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-muted-foreground mb-1">Tempo Médio de Resposta</p>
        <p className="text-2xl font-bold text-foreground">{data.average}</p>
      </div>
    </div>
  );
};
