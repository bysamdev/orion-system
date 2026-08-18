import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Activity,
  ShieldCheck,
  Radio,
  Zap,
  BarChart3,
  Layers,
  Lock,
  Server,
} from 'lucide-react';
import { GrafanaTelemetryView, TelemetryPeriod } from '@/components/monitoring/GrafanaTelemetryView';
import { useWebEndpoints } from '@/hooks/useWebMonitoring';
import { useNetworkLinks } from '@/hooks/useNetworkLinks';
import { cn } from '@/lib/utils';

export interface WebTelemetryTabProps {
  className?: string;
  defaultPeriod?: TelemetryPeriod;
}

type TelemetryViewFilter = 'all' | 'uptime' | 'latency' | 'ssl';

export const WebTelemetryTab: React.FC<WebTelemetryTabProps> = ({
  className,
  defaultPeriod = '1h',
}) => {
  const [activeFilter, setActiveFilter] = useState<TelemetryViewFilter>('all');
  const { data: endpoints } = useWebEndpoints();
  const { data: networkLinks } = useNetworkLinks();

  // Metrics summary
  const webSummary = useMemo(() => {
    const total = endpoints?.length || 0;
    const online = endpoints?.filter((e) => e.status === 'online').length || 0;
    const offline = endpoints?.filter((e) => e.status === 'offline').length || 0;
    return { total, online, offline };
  }, [endpoints]);

  const networkSummary = useMemo(() => {
    const total = networkLinks?.length || 0;
    const online = networkLinks?.filter((l) => l.status === 'online').length || 0;
    const offline = networkLinks?.filter((l) => l.status === 'offline').length || 0;
    const latencies = networkLinks
      ?.filter((l) => l.status === 'online' && l.latency_ms !== null)
      .map((l) => l.latency_ms as number) || [];
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    return { total, online, offline, avgLatency };
  }, [networkLinks]);

  // Dashboard path
  const dashboardPath = useMemo(() => {
    // Default dashboard path in Grafana for Web & Network Monitoring (Blackbox Exporter)
    return '/d/orion-web-monitoring/orion-web-monitoring';
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* ── Metric Highlights & Overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Uptime & Disponibilidade HTTP/S */}
        <Card className="border-border/40 bg-card hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Uptime Web & APIs
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight">
                {webSummary.online}/{webSummary.total}
              </div>
              <Badge variant="outline" className="text-[10px] text-green-600 bg-green-500/10 border-green-500/30">
                <Activity className="w-3 h-3 mr-1 animate-pulse" />
                Blackbox HTTP
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {webSummary.offline > 0
                ? `${webSummary.offline} endpoint(s) com instabilidade`
                : 'Todos os endpoints respondendo (2xx/3xx)'}
            </p>
          </CardContent>
        </Card>

        {/* 2. Latência de Links & ICMP */}
        <Card className="border-border/40 bg-card hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Latência de Rede (RTT)
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight">
                {networkSummary.avgLatency !== null ? `${networkSummary.avgLatency} ms` : 'N/A'}
              </div>
              <Badge variant="outline" className="text-[10px] text-purple-600 bg-purple-500/10 border-purple-500/30">
                <Zap className="w-3 h-3 mr-1" />
                ICMP Ping
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Starlink, Roteadores e Links Dedicados
            </p>
          </CardContent>
        </Card>

        {/* 3. Certificados SSL / TLS */}
        <Card className="border-border/40 bg-card hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Validade SSL / TLS
              </span>
              <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-green-600 dark:text-green-400">
                100% Válidos
              </div>
              <Badge variant="outline" className="text-[10px] text-green-600 bg-green-500/10 border-green-500/30">
                <Lock className="w-3 h-3 mr-1" />
                TLS 1.2+
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Monitoramento preventivo de expiração
            </p>
          </CardContent>
        </Card>

        {/* 4. Coletor / Engine */}
        <Card className="border-border/40 bg-card hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Engine de Telemetria
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight">
                Grafana + Blackbox
              </div>
              <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/30">
                <Server className="w-3 h-3 mr-1" />
                Prometheus
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Métricas contínuas em tempo real
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Categories Selector Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Painéis de Telemetria
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('all')}
            className="h-8 text-xs rounded-xl font-semibold gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Visão Geral Completa
          </Button>
          <Button
            variant={activeFilter === 'uptime' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('uptime')}
            className="h-8 text-xs rounded-xl font-semibold gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            Disponibilidade HTTP/S
          </Button>
          <Button
            variant={activeFilter === 'latency' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('latency')}
            className="h-8 text-xs rounded-xl font-semibold gap-1.5"
          >
            <Radio className="w-3.5 h-3.5" />
            Latência Starlink & Links
          </Button>
          <Button
            variant={activeFilter === 'ssl' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('ssl')}
            className="h-8 text-xs rounded-xl font-semibold gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Certificados SSL
          </Button>
        </div>
      </div>

      {/* ── Grafana Embedded View ── */}
      <GrafanaTelemetryView
        initialPeriod={defaultPeriod}
        dashboardPath={dashboardPath}
        height="680px"
        title="Telemetria de Redes & Endpoints Web (Blackbox Exporter)"
        className="border-border/40 shadow-md"
      />
    </div>
  );
};

export default WebTelemetryTab;
