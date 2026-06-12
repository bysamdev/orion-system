import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  WifiOff,
  HardDrive,
  Cpu,
  RefreshCw,
  ShieldAlert,
  Loader2,
  Lock,
  Clock,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useCriticalAlerts, useMonitoringDashboard } from '@/hooks/useMonitoring';
import type { CriticalAlertItem } from '@/hooks/useMonitoring';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Alert Card ──────────────────────────────────────────────
function AlertCard({ alert }: { alert: CriticalAlertItem }) {
  const iconMap = {
    offline: WifiOff,
    disk: HardDrive,
    cpu: Cpu,
    alert: ShieldAlert,
  };
  const colorMap = {
    offline: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-600', icon: 'bg-red-600' },
    disk: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600', icon: 'bg-orange-600' },
    cpu: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600', icon: 'bg-amber-600' },
    alert: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600', icon: 'bg-rose-600' },
  };

  const Icon = iconMap[alert.alert_type] || AlertTriangle;
  const colors = colorMap[alert.alert_type] || colorMap.alert;

  return (
    <Card className={cn(
      'border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg group',
      colors.bg, colors.border
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-2.5 rounded-xl text-white shadow-lg flex-shrink-0 transition-transform group-hover:scale-110',
            colors.icon,
            alert.severity === 'critical' && 'animate-pulse'
          )}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="font-bold text-sm text-foreground truncate">{alert.hostname}</h4>
              <Badge
                variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0"
              >
                {alert.severity === 'critical' ? 'CRÍTICO' : 'AVISO'}
              </Badge>
            </div>

            <p className={cn('text-xs font-medium', colors.text)}>
              {alert.message}
            </p>

            <div className="flex items-center gap-3 mt-2.5">
              {alert.group_name && (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                  {alert.group_name}
                </span>
              )}
              {alert.metric_value != null && (
                <span className={cn('text-xs font-black', colors.text)}>
                  {alert.metric_value}%
                </span>
              )}
              {alert.last_seen && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(alert.last_seen), { locale: ptBR, addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section ─────────────────────────────────────────────────
function AlertSection({
  title,
  icon: Icon,
  colorClass,
  alerts,
}: {
  title: string;
  icon: React.ElementType;
  colorClass: string;
  alerts: CriticalAlertItem[];
}) {
  if (alerts.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl text-white', colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
          {title}
        </h2>
        <Badge variant="outline" className={cn('text-[10px] font-black', colorClass.replace('bg-', 'text-').replace('-600', '-500'))}>
          {alerts.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {alerts.map((a, i) => (
          <AlertCard key={`${a.machine_id}-${a.alert_type}-${i}`} alert={a} />
        ))}
      </div>
    </section>
  );
}

// ── Main Page ───────────────────────────────────────────────
const AlertsDashboard: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: alerts = [], isLoading } = useCriticalAlerts();
  const { data: dashboard } = useMonitoringDashboard();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const grouped = useMemo(() => ({
    offline: alerts.filter(a => a.alert_type === 'offline'),
    disk: alerts.filter(a => a.alert_type === 'disk'),
    cpu: alerts.filter(a => a.alert_type === 'cpu'),
    alert: alerts.filter(a => a.alert_type === 'alert'),
  }), [alerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['monitoring', 'alerts', 'critical'] });
    setTimeout(() => setRefreshing(false), 800);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'customer') {
    return <Navigate to="/tutorial" replace />;
  }

  if (role && !['admin', 'developer', 'technician', 'gestor'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 space-y-4 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você não tem permissão para acessar esta área técnica.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1600px] mx-auto w-full">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Central de Alertas
              </h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Zona Vermelha — Atenção Imediata
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {dashboard && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-red-600 border-red-500/30 bg-red-500/10 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2 rounded-xl"
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="p-8 bg-green-500/10 rounded-full">
                <ShieldAlert className="h-16 w-16 text-green-500" />
              </div>
              <span className="absolute bottom-2 right-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-black">✓</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground mb-2">Tudo Tranquilo!</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Nenhum alerta crítico no momento. Todas as máquinas estão operando dentro dos limites normais.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-10 pr-4">
              <AlertSection
                title="Máquinas Offline"
                icon={WifiOff}
                colorClass="bg-red-600"
                alerts={grouped.offline}
              />
              <AlertSection
                title="Disco Crítico (>90%)"
                icon={HardDrive}
                colorClass="bg-orange-600"
                alerts={grouped.disk}
              />
              <AlertSection
                title="CPU Sob Pressão (>85%)"
                icon={Cpu}
                colorClass="bg-amber-600"
                alerts={grouped.cpu}
              />
              <AlertSection
                title="Alertas do Sistema"
                icon={ShieldAlert}
                colorClass="bg-rose-600"
                alerts={grouped.alert}
              />
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  );
};

const AlertsDashboardWrapper: React.FC = () => (
  <ErrorBoundary>
    <AlertsDashboard />
  </ErrorBoundary>
);

export default AlertsDashboardWrapper;
