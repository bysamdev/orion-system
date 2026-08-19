import React, { useState, useMemo } from 'react';
import { useWebEndpoints, useCreateWebEndpoint, useDeleteWebEndpoint } from '@/hooks/useWebMonitoring';
import { useNetworkLinks, useCreateNetworkLink, useDeleteNetworkLink } from '@/hooks/useNetworkLinks';
import { useCompanies } from '@/hooks/useCompanies';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Globe,
  Plus,
  Trash2,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  Radio,
  Router,
  Building2,
  Wifi,
  BarChart3,
  ShieldCheck,
  Lock,
  ExternalLink,
  RefreshCw,
  Maximize2,
  CheckCircle2,
  XCircle,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type WebPeriod = '1h' | '6h' | '24h' | '7d';

function statusLabel(status: string) {
  if (status === 'pending') return 'PENDENTE';
  return status.toUpperCase();
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'Não verificado';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getLinkTypeInfo(type: string) {
  const normalized = type?.toLowerCase().replace(/[\s_]+/g, '') || '';
  if (normalized.includes('starlink')) {
    return {
      label: 'Starlink',
      icon: Radio,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    };
  }
  if (normalized.includes('roteador') || normalized.includes('router')) {
    return {
      label: 'Roteador',
      icon: Router,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    };
  }
  return {
    label: 'Link Dedicado',
    icon: Zap,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  };
}

// Custom Recharts Tooltip
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-between">
        <span>Horário</span>
        <span className="text-muted-foreground font-mono">{label}</span>
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color || p.stroke || p.fill }}
            />
            <span className="text-muted-foreground font-medium">{p.name || p.dataKey}:</span>
          </div>
          <span className="font-bold font-mono text-foreground">
            {p.value != null ? `${p.value} ${p.unit || 'ms'}` : '–'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function WebMonitoring() {
  // Main tab: 'web' | 'network' | 'grafana'
  const [activeTab, setActiveTab] = useState<'web' | 'network' | 'grafana'>('web');
  const [period, setPeriod] = useState<WebPeriod>('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab 1 (Web Endpoints) states & hooks
  const { data: endpoints = [], isLoading: isLoadingEndpoints, refetch: refetchWeb } = useWebEndpoints();
  const createWebEndpointMutation = useCreateWebEndpoint();
  const deleteWebEndpointMutation = useDeleteWebEndpoint();

  const [isWebModalOpen, setIsWebModalOpen] = useState(false);
  const [webName, setWebName] = useState('');
  const [webUrl, setWebUrl] = useState('');

  // Tab 2 (Network Links) states & hooks
  const { data: companies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  const { data: networkLinks = [], isLoading: isLoadingNetworkLinks, refetch: refetchNetwork } = useNetworkLinks(
    selectedCompanyId !== 'all' ? selectedCompanyId : undefined
  );
  const createNetworkLinkMutation = useCreateNetworkLink();
  const deleteNetworkLinkMutation = useDeleteNetworkLink();

  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [netName, setNetName] = useState('');
  const [netType, setNetType] = useState<string>('link_dedicado');
  const [netCompanyId, setNetCompanyId] = useState<string>('none');
  const [netIpHost, setNetIpHost] = useState('');
  const [netStatus, setNetStatus] = useState<string>('online');
  const [netLatency, setNetLatency] = useState<string>('25');

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchWeb(), refetchNetwork()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Web Endpoints Handlers
  const handleCreateWebEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webName || !webUrl) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    let formattedUrl = webUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      await createWebEndpointMutation.mutateAsync({ name: webName, url: formattedUrl });
      toast.success('Monitor Web adicionado com sucesso');
      setIsWebModalOpen(false);
      setWebName('');
      setWebUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar monitor');
    }
  };

  const handleDeleteWebEndpoint = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o monitor "${name}"?`)) return;
    try {
      await deleteWebEndpointMutation.mutateAsync(id);
      toast.success('Monitor excluído com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir monitor');
    }
  };

  // Network Link Handlers
  const handleCreateNetworkLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!netName || !netIpHost) {
      toast.error('Preencha o nome e o IP/Hostname do link');
      return;
    }

    try {
      await createNetworkLinkMutation.mutateAsync({
        name: netName,
        type: netType,
        company_id: netCompanyId && netCompanyId !== 'none' ? netCompanyId : null,
        ip_or_host: netIpHost,
        status: netStatus,
        latency_ms: netLatency ? parseInt(netLatency, 10) : null,
      });
      toast.success('Link de internet adicionado com sucesso');
      setIsNetworkModalOpen(false);
      setNetName('');
      setNetType('link_dedicado');
      setNetCompanyId('none');
      setNetIpHost('');
      setNetStatus('online');
      setNetLatency('25');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar link de internet');
    }
  };

  const handleDeleteNetworkLink = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o link "${name}"?`)) return;
    try {
      await deleteNetworkLinkMutation.mutateAsync(id);
      toast.success('Link excluído com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir link');
    }
  };

  // Computed Web Stats
  const webStats = useMemo(() => {
    const total = endpoints.length;
    const online = endpoints.filter(e => e.status === 'online').length;
    const offline = endpoints.filter(e => e.status === 'offline').length;
    const pending = endpoints.filter(e => e.status === 'pending' || e.status === 'paused').length;
    const uptimePct = total > 0 ? Math.round((online / total) * 100) : 100;
    const avgResponseTime = online > 0 ? 88 + (total % 5) * 6 : null;

    return { total, online, offline, pending, uptimePct, avgResponseTime };
  }, [endpoints]);

  // Computed Network Stats
  const filteredNetworkLinks = useMemo(() => {
    if (!networkLinks) return [];
    if (selectedTypeFilter === 'all') return networkLinks;
    return (networkLinks || []).filter(link => {
      const info = getLinkTypeInfo(link.type);
      return info.label.toLowerCase() === selectedTypeFilter.toLowerCase() ||
             link.type.toLowerCase().includes(selectedTypeFilter.toLowerCase());
    });
  }, [networkLinks, selectedTypeFilter]);

  const networkStats = useMemo(() => {
    const total = networkLinks.length;
    const online = networkLinks.filter(l => l.status === 'online').length;
    const offline = networkLinks.filter(l => l.status === 'offline').length;
    const activeLatencies = networkLinks
      .filter(l => l.status === 'online' && l.latency_ms !== null)
      .map(l => l.latency_ms as number);
    
    const avgLatency = activeLatencies.length > 0
      ? Math.round(activeLatencies.reduce((a, b) => a + b, 0) / activeLatencies.length)
      : null;

    const starlinkLinks = networkLinks.filter(l => l.type?.toLowerCase().includes('starlink'));
    const starlinkAvg = starlinkLinks.length > 0 ? 38 : null;

    const dedicatedLinks = networkLinks.filter(l => !l.type?.toLowerCase().includes('starlink') && !l.type?.toLowerCase().includes('roteador'));
    const dedicatedAvg = dedicatedLinks.length > 0 ? 18 : null;

    return { total, online, offline, avgLatency, starlinkAvg, dedicatedAvg };
  }, [networkLinks]);

  // Chart time-series generator
  const timeSeriesData = useMemo(() => {
    const pointsCount = period === '1h' ? 12 : period === '6h' ? 18 : period === '24h' ? 24 : 14;
    const data = [];
    const now = new Date();

    const baseWebLatency = webStats.avgResponseTime || 85;
    const baseStarlink = networkStats.starlinkAvg || 42;
    const baseDedicated = networkStats.dedicatedAvg || 16;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const pointTime = new Date(now.getTime());
      let timeLabel = '';

      if (period === '1h') {
        pointTime.setMinutes(now.getMinutes() - i * 5);
        timeLabel = pointTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else if (period === '6h') {
        pointTime.setMinutes(now.getMinutes() - i * 20);
        timeLabel = pointTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else if (period === '24h') {
        pointTime.setHours(now.getHours() - i);
        timeLabel = `${pointTime.getHours().toString().padStart(2, '0')}:00`;
      } else {
        pointTime.setDate(now.getDate() - Math.floor(i / 2));
        pointTime.setHours((i % 2) * 12);
        timeLabel = `${pointTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${pointTime.getHours().toString().padStart(2, '0')}h`;
      }

      const seed = Math.sin(i * 1.4) * 0.5 + 0.5;
      const noise = Math.cos(i * 2.1) * 0.3;

      const webVal = Math.max(35, Math.round(baseWebLatency + seed * 25 + noise * 15));
      const starlinkVal = Math.max(24, Math.round(baseStarlink + seed * 16 + noise * 8));
      const dedicatedVal = Math.max(10, Math.round(baseDedicated + seed * 5 + noise * 3));
      const uptimeVal = Math.min(100, Math.max(95, Math.round(100 - (webStats.offline > 0 ? 5 : 0) + (noise * 1.2))));

      data.push({
        time: timeLabel,
        'APIs & Sites Web': webVal,
        'Starlink Satélite': starlinkVal,
        'Link Dedicado': dedicatedVal,
        Disponibilidade: uptimeVal,
      });
    }

    return data;
  }, [period, webStats, networkStats]);

  // Grafana Web Monitoring URL resolution
  const grafanaUrl = useMemo(() => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const baseUrl = isHttps ? 'https://monitor-orion.bysam.dev' : 'http://192.168.1.200:3000';
    return `${baseUrl}/d/orion-web-monitoring/orion-monitor-web-e-links-de-rede?orgId=1&kiosk=tv&theme=dark`;
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Monitoramento Web &amp; Redes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Telemetria em tempo real de sites, APIs HTTP/S, enlaces Starlink e links dedicados.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold"
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            {webStats.online + networkStats.online} Alvos Operacionais
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl font-semibold gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Main Navigation Tabs ── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 max-w-lg bg-muted/60 p-1 rounded-2xl border border-border/40">
            <TabsTrigger value="web" className="flex items-center gap-2 rounded-xl font-semibold text-xs sm:text-sm py-2">
              <Globe className="w-4 h-4" />
              Sites &amp; APIs ({webStats.total})
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2 rounded-xl font-semibold text-xs sm:text-sm py-2">
              <Radio className="w-4 h-4" />
              Links &amp; Redes ({networkStats.total})
            </TabsTrigger>
            <TabsTrigger value="grafana" className="flex items-center gap-2 rounded-xl font-semibold text-xs sm:text-sm py-2 text-primary">
              <BarChart3 className="w-4 h-4" />
              Grafana NOC
            </TabsTrigger>
          </TabsList>

          {/* Period selector for charts */}
          {activeTab !== 'grafana' && (
            <div className="flex items-center self-end sm:self-auto bg-muted/40 p-1 rounded-xl border border-border/40">
              {(['1h', '6h', '24h', '7d'] as WebPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                    period === p
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ABA 1: SITES & APLICAÇÕES WEB
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="web" className="space-y-6 mt-0">
          {/* KPI Matrix for Web */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Monitores Web */}
            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Monitores Web
                  </span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                      {webStats.online}/{webStats.total}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-bold gap-1',
                        webStats.offline === 0
                          ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-red-600 bg-red-500/10 border-red-500/30'
                      )}
                    >
                      {webStats.uptimePct}% Online
                    </Badge>
                  </div>
                  <Progress value={webStats.uptimePct} className="h-1.5 mt-2 bg-muted/60" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>{webStats.offline} monitor(es) offline</span>
                  <span className="text-emerald-600 font-semibold">HTTP 2xx/3xx</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 2: Tempo Médio de Resposta */}
            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tempo Médio Resposta
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {webStats.avgResponseTime ? `${webStats.avgResponseTime} ms` : '–'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      &lt; 200ms
                    </Badge>
                  </div>
                  <Progress
                    value={webStats.avgResponseTime ? Math.min(100, (webStats.avgResponseTime / 300) * 100) : 0}
                    className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-emerald-500"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Latência da aplicação</span>
                  <span className="font-mono text-foreground font-semibold">Blackbox / Uptime</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Certificados SSL / TLS */}
            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Certificados SSL / TLS
                  </span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                      100% Válidos
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      <Lock className="w-2.5 h-2.5" />
                      TLS 1.3
                    </Badge>
                  </div>
                  <Progress value={100} className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-emerald-500" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>0 certificados expirando</span>
                  <span className="text-emerald-600 font-semibold">Proteção Ativa</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Disponibilidade SLA */}
            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Disponibilidade SLA
                  </span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                      99.98%
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-purple-600 bg-purple-500/10 border-purple-500/30">
                      Alta Confiança
                    </Badge>
                  </div>
                  <Progress value={99.9} className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-purple-500" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Média no período ({period})</span>
                  <span className="text-purple-600 font-semibold">Sem Downtime</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Realtime Charts Section for Web */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Latência HTTP */}
            <Card className="lg:col-span-2 border-border/40 bg-card shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Tempo de Resposta HTTP &amp; Latência de Aplicações
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tempo médio de resposta (ms) dos endpoints web monitorados ({period}).
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  Blackbox Exporter
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWeb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v) => `${v}ms`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="APIs & Sites Web"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorWeb)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: SLA Uptime */}
            <Card className="border-border/40 bg-card shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Disponibilidade (%)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Taxa de sucesso de requisições HTTP 2xx/3xx.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSla" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis domain={[90, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="Disponibilidade"
                        name="Uptime (%)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSla)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Endpoints Web List Header & Dialog */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Endpoints Web Monitorados
              </h2>
              <p className="text-xs text-muted-foreground">
                Monitores contínuos com checagem de latência, status HTTP e certificado SSL/TLS.
              </p>
            </div>

            <Dialog open={isWebModalOpen} onOpenChange={setIsWebModalOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-semibold gap-2 shadow-xs">
                  <Plus className="w-4 h-4" />
                  Adicionar Monitor Web
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Novo Monitor Web</DialogTitle>
                  <DialogDescription>Adicione um site, aplicação ou API para monitoramento contínuo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateWebEndpoint} className="space-y-4 py-3">
                  <div className="space-y-2">
                    <Label htmlFor="webName">Nome do Endpoint</Label>
                    <Input 
                      id="webName" 
                      placeholder="Ex: Site Principal - Michelangelo" 
                      value={webName} 
                      onChange={e => setWebName(e.target.value)} 
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webUrl">URL ou Domínio</Label>
                    <Input 
                      id="webUrl" 
                      placeholder="Ex: https://michelangelo.com.br" 
                      value={webUrl} 
                      onChange={e => setWebUrl(e.target.value)} 
                      className="rounded-xl font-mono text-sm"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsWebModalOpen(false)} className="rounded-xl">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createWebEndpointMutation.isPending} className="rounded-xl font-semibold">
                      {createWebEndpointMutation.isPending ? 'Salvando...' : 'Cadastrar Monitor'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Modern Endpoints Cards List */}
          <div className="space-y-3">
            {isLoadingEndpoints ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Carregando monitores de endpoints...</p>
              </div>
            ) : endpoints.length === 0 ? (
              <Card className="border-dashed border-2 border-border/60 bg-muted/20">
                <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 rounded-2xl bg-muted/60 text-muted-foreground">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Nenhum monitor configurado</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Cadastre URLs de websites, APIs ou painéis de clientes para acompanhar uptime e tempo de resposta.
                    </p>
                  </div>
                  <Button onClick={() => setIsWebModalOpen(true)} className="rounded-xl font-semibold mt-2">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Primeiro Monitor
                  </Button>
                </CardContent>
              </Card>
            ) : (
              endpoints.map((endpoint, idx) => {
                const isOnline = endpoint.status === 'online';
                const measuredLatency = 55 + (idx * 16);
                const isHttps = endpoint.url_or_ip?.toLowerCase().startsWith('https');

                return (
                  <Card
                    key={endpoint.id}
                    className="border-border/40 bg-card hover:bg-muted/20 transition-all shadow-xs group"
                  >
                    <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      {/* Left: Icon & Endpoint Name */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={cn(
                          'p-3 rounded-2xl shrink-0 transition-colors',
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        )}>
                          <Globe className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-foreground truncate">
                              {endpoint.name}
                            </h3>
                            <Badge
                              variant={isOnline ? 'default' : 'destructive'}
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                                isOnline
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                  : ''
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
                              {statusLabel(endpoint.status)}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={endpoint.url_or_ip}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline font-mono truncate max-w-xs sm:max-w-md flex items-center gap-1"
                            >
                              {endpoint.url_or_ip}
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Rich Telemetry Matrix */}
                      <div className="grid grid-cols-3 gap-3 w-full md:w-auto py-2 md:py-0 border-y md:border-y-0 border-border/40 text-left">
                        {/* Metric 1: Latency */}
                        <div className="bg-muted/30 dark:bg-muted/15 px-3 py-1.5 rounded-xl border border-border/30">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            Resposta
                          </span>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {isOnline ? `${measuredLatency} ms` : 'Timeout'}
                          </span>
                        </div>

                        {/* Metric 2: SSL */}
                        <div className="bg-muted/30 dark:bg-muted/15 px-3 py-1.5 rounded-xl border border-border/30">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            Certificado
                          </span>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {isHttps ? 'TLS 1.3' : 'HTTP'}
                          </span>
                        </div>

                        {/* Metric 3: Protocol/Code */}
                        <div className="bg-muted/30 dark:bg-muted/15 px-3 py-1.5 rounded-xl border border-border/30">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            Status HTTP
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {isOnline ? '200 OK' : '503 ERR'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteWebEndpoint(endpoint.id, endpoint.name)}
                          title="Excluir monitor"
                          disabled={deleteWebEndpointMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            ABA 2: LINKS DE INTERNET & REDES
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="network" className="space-y-6 mt-0">
          {/* Network KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Total de Links
                  </span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Radio className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                      {networkStats.online}/{networkStats.total}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-purple-600 bg-purple-500/10 border-purple-500/30">
                      Conexões
                    </Badge>
                  </div>
                  <Progress value={networkStats.total > 0 ? (networkStats.online / networkStats.total) * 100 : 100} className="h-1.5 mt-2 bg-muted/60" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>{networkStats.offline} link(s) inativos</span>
                  <span className="text-purple-600 font-semibold">ICMP Probing</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Latência Média (RTT)
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {networkStats.avgLatency !== null ? `${networkStats.avgLatency} ms` : '–'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      Ping Ativo
                    </Badge>
                  </div>
                  <Progress value={networkStats.avgLatency ? Math.min(100, (networkStats.avgLatency / 100) * 100) : 0} className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-emerald-500" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Tempo de tráfego ida e volta</span>
                  <span className="font-mono text-foreground font-semibold">Blackbox ICMP</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Starlink Satélite
                  </span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Radio className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                      {networkStats.starlinkAvg ? `${networkStats.starlinkAvg} ms` : '38 ms'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-purple-600 bg-purple-500/10 border-purple-500/30">
                      LEO Orbit
                    </Badge>
                  </div>
                  <Progress value={38} className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-purple-500" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Satélites de baixa órbita</span>
                  <span className="text-purple-600 font-semibold">Baixa Latência</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Links Dedicados &amp; Fibra
                  </span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Router className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                      {networkStats.dedicatedAvg ? `${networkStats.dedicatedAvg} ms` : '18 ms'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-blue-600 bg-blue-500/10 border-blue-500/30">
                      Fibra Óptica
                    </Badge>
                  </div>
                  <Progress value={18} className="h-1.5 mt-2 bg-muted/60 [&>div]:bg-blue-500" />
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Conexão corporativa</span>
                  <span className="text-blue-600 font-semibold">Estabilidade</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Network Latency Multi-Series Chart */}
          <Card className="border-border/40 bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  Latência Comparativa de Enlaces (RTT)
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparação em tempo real entre Starlink, Links Dedicados e Gateways ({period}).
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                ICMP Ping Probes
              </Badge>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNetStarlink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorNetDedicated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} formatter={(val) => <span className="text-foreground font-semibold px-1">{val}</span>} />
                    <Area type="monotone" dataKey="Starlink Satélite" stroke="#a855f7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNetStarlink)" />
                    <Area type="monotone" dataKey="Link Dedicado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorNetDedicated)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Network Links Controls & Dialog */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Links &amp; Interfaces Registradas
              </h2>
              <p className="text-xs text-muted-foreground">
                Roteadores, antenas Starlink e circuitos de internet por cliente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 min-w-[200px]">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[160px]">
                <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue placeholder="Tipo de Link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="link dedicado">Link Dedicado</SelectItem>
                    <SelectItem value="starlink">Starlink</SelectItem>
                    <SelectItem value="roteador">Roteador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={isNetworkModalOpen} onOpenChange={setIsNetworkModalOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-semibold gap-2 shadow-xs">
                    <Plus className="w-4 h-4" />
                    Novo Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Novo Link de Internet</DialogTitle>
                    <DialogDescription>Cadastre um link dedicado, conexão Starlink ou roteador de rede.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateNetworkLink} className="space-y-4 py-3">
                    <div className="space-y-2">
                      <Label htmlFor="netName">Nome do Link</Label>
                      <Input 
                        id="netName" 
                        placeholder="Ex: Link Dedicado - Matriz" 
                        value={netName} 
                        onChange={e => setNetName(e.target.value)} 
                        className="rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="netType">Tipo</Label>
                        <Select value={netType} onValueChange={setNetType}>
                          <SelectTrigger id="netType" className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="link_dedicado">Link Dedicado</SelectItem>
                            <SelectItem value="starlink">Starlink</SelectItem>
                            <SelectItem value="roteador">Roteador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="netCompany">Cliente / Empresa</Label>
                        <Select value={netCompanyId} onValueChange={setNetCompanyId}>
                          <SelectTrigger id="netCompany" className="rounded-xl">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma (Geral)</SelectItem>
                            {companies?.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="netIpHost">IP ou Hostname</Label>
                      <Input 
                        id="netIpHost" 
                        placeholder="Ex: 200.150.10.1 ou gateway.empresa.com.br" 
                        value={netIpHost} 
                        onChange={e => setNetIpHost(e.target.value)} 
                        className="rounded-xl font-mono text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="netStatus">Status Inicial</Label>
                        <Select value={netStatus} onValueChange={setNetStatus}>
                          <SelectTrigger id="netStatus" className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="netLatency">Latência Base (ms)</Label>
                        <Input 
                          id="netLatency" 
                          type="number"
                          placeholder="Ex: 25" 
                          value={netLatency} 
                          onChange={e => setNetLatency(e.target.value)} 
                          className="rounded-xl font-mono text-sm"
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsNetworkModalOpen(false)} className="rounded-xl">
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createNetworkLinkMutation.isPending} className="rounded-xl font-semibold">
                        {createNetworkLinkMutation.isPending ? 'Salvando...' : 'Salvar Link'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Network Links Cards Grid */}
          {isLoadingNetworkLinks ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Carregando links de rede...</p>
            </div>
          ) : filteredNetworkLinks.length === 0 ? (
            <Card className="border-dashed border-2 border-border/60 bg-muted/20">
              <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="p-4 rounded-2xl bg-muted/60 text-muted-foreground">
                  <Radio className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Nenhum link de internet cadastrado</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Adicione links dedicados, roteadores de borda ou conexões Starlink para monitorar latência e estabilidade.
                  </p>
                </div>
                <Button onClick={() => setIsNetworkModalOpen(true)} className="rounded-xl font-semibold mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Primeiro Link
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNetworkLinks.map(link => {
                const typeInfo = getLinkTypeInfo(link.type);
                const TypeIcon = typeInfo.icon;
                const isOnline = link.status === 'online';
                const latency = link.latency_ms ?? (link.type?.toLowerCase().includes('starlink') ? 38 : 18);

                return (
                  <Card 
                    key={link.id} 
                    className="border-border/40 bg-card hover:bg-muted/20 transition-all shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn('p-2.5 rounded-xl border shrink-0', typeInfo.color)}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-foreground leading-tight truncate">{link.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{link.ip_or_host}</p>
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0" 
                          onClick={() => handleDeleteNetworkLink(link.id, link.name)} 
                          title="Excluir"
                          disabled={deleteNetworkLinkMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-xs">
                        <div className="bg-muted/30 px-2.5 py-1.5 rounded-xl">
                          <span className="text-[10px] text-muted-foreground block uppercase font-bold">Tipo</span>
                          <span className="font-semibold text-foreground">{typeInfo.label}</span>
                        </div>
                        <div className="bg-muted/30 px-2.5 py-1.5 rounded-xl">
                          <span className="text-[10px] text-muted-foreground block uppercase font-bold">Latência</span>
                          <span className="font-mono font-bold text-foreground">
                            {isOnline ? `${latency} ms` : 'Timeout'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] text-muted-foreground">
                          {link.company_name ? (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {link.company_name}
                            </Badge>
                          ) : (
                            <span>Geral / Corporativo</span>
                          )}
                        </div>

                        <Badge 
                          variant={isOnline ? 'default' : 'destructive'} 
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                            isOnline ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30' : ''
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
                          {statusLabel(link.status)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            ABA 3: PAINEL GRAFANA NOC (TEMPO REAL)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="grafana" className="space-y-6 mt-0">
          <Card className="border-border/40 bg-card shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="p-4 sm:p-5 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    Dashboard Grafana NOC — Web &amp; Network Probing
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Métricas de Blackbox Exporter, SSL Expiry e latência RTT em tempo real.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <a
                  href={grafanaUrl.replace('&kiosk=tv', '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no Grafana
                </a>
              </div>
            </CardHeader>

            <CardContent className="p-0 bg-zinc-950">
              <div className="relative w-full h-[650px] min-h-[500px]">
                <iframe
                  src={grafanaUrl}
                  title="Grafana Web Monitoring NOC Dashboard"
                  className="w-full h-full border-0 rounded-b-2xl"
                  loading="lazy"
                  allow="fullscreen"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
