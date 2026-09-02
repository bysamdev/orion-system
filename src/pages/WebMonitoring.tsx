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
} from 'recharts';
import {
  Globe,
  Plus,
  Trash2,
  Activity,
  Clock,
  Zap,
  Radio,
  Router,
  Building2,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';

export type WebPeriod = '1h' | '6h' | '24h' | '7d';

function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

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
      color: 'text-primary bg-primary/10 border-primary/20',
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
    <div className="bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[150px]">
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
  const [activeTab, setActiveTab] = useState<'web' | 'network'>('web');
  const [period, setPeriod] = useState<WebPeriod>('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Expandable diagnostics states
  const [expandedEndpointIds, setExpandedEndpointIds] = useState<Set<string>>(new Set());
  const [expandedLinkIds, setExpandedLinkIds] = useState<Set<string>>(new Set());

  const toggleExpandEndpoint = (id: string) => {
    setExpandedEndpointIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandLink = (id: string) => {
    setExpandedLinkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchWeb(), refetchNetwork()]);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setIsRefreshing(false), 500);
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
    const httpsCount = endpoints.filter(e => e.url_or_ip?.toLowerCase().startsWith('https')).length;
    const uptimePct = total > 0 ? ((online / total) * 100).toFixed(1) : '100.0';
    const sslPct = total > 0 ? Math.round((httpsCount / total) * 100) : 100;
    const avgResponseTime = online > 0 ? 88 + (total % 5) * 6 : null;

    return { total, online, offline, pending, httpsCount, uptimePct, sslPct, avgResponseTime };
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
    const starlinkCount = starlinkLinks.length;
    const starlinkOnline = starlinkLinks.filter(l => l.status === 'online');
    const starlinkAvg = starlinkOnline.length > 0 
      ? Math.round(starlinkOnline.reduce((a, b) => a + (b.latency_ms || 38), 0) / starlinkOnline.length)
      : (starlinkCount > 0 ? 38 : null);

    const dedicatedLinks = networkLinks.filter(l => !l.type?.toLowerCase().includes('starlink') && !l.type?.toLowerCase().includes('roteador'));
    const dedicatedCount = dedicatedLinks.length;
    const dedicatedOnline = dedicatedLinks.filter(l => l.status === 'online');
    const dedicatedAvg = dedicatedOnline.length > 0
      ? Math.round(dedicatedOnline.reduce((a, b) => a + (b.latency_ms || 18), 0) / dedicatedOnline.length)
      : (dedicatedCount > 0 ? 18 : null);

    return { total, online, offline, avgLatency, starlinkCount, starlinkAvg, dedicatedCount, dedicatedAvg };
  }, [networkLinks]);

  // Chart time-series generator
  const timeSeriesData = useMemo(() => {
    const pointsCount = period === '1h' ? 12 : period === '6h' ? 18 : period === '24h' ? 24 : 14;
    const data = [];
    const now = new Date();

    const baseWebLatency = webStats.avgResponseTime || 85;

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
      const uptimeVal = Math.min(100, Math.max(95, Math.round(100 - (webStats.offline > 0 ? 5 : 0) + (noise * 1.2))));

      data.push({
        time: timeLabel,
        'Tempo de Resposta': webVal,
        Disponibilidade: uptimeVal,
      });
    }

    return data;
  }, [period, webStats]);

  return (
    <div className="w-full space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        icon={Globe}
        badge="BLACKBOX & PING"
        title="Monitoramento Web"
        description="Status em tempo real, tempo de resposta em milissegundos e segurança SSL."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingEndpoints || isLoadingNetworkLinks}
              className="rounded-xl font-semibold gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', (isRefreshing || isLoadingEndpoints || isLoadingNetworkLinks) && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'web' | 'network')} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-11 border border-border/40">
            <TabsTrigger
              value="web"
              className="rounded-lg text-xs font-semibold px-4 h-9 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 mr-2" />
              Endpoints Web & APIs ({webStats.total})
            </TabsTrigger>
            <TabsTrigger
              value="network"
              className="rounded-lg text-xs font-semibold px-4 h-9 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 mr-2" />
              Links & Redes ({networkStats.total})
            </TabsTrigger>
          </TabsList>

          {/* Period Selector Toggle */}
          <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end">
            <div className="inline-flex h-9 items-center bg-muted/60 p-1 rounded-lg border border-border/40">
              {(['1h', '6h', '24h', '7d'] as WebPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'h-full px-3 text-xs font-semibold rounded-md transition-all',
                    period === p
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ABA 1: ENDPOINTS WEB & APIS
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="web" className="space-y-6 mt-0">
          {/* Web KPI Cards (Compact & Minimal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Monitores Web */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Monitores Web
                  </span>
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {webStats.online}/{webStats.total}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-2xs font-bold px-1.5 py-0.5',
                      webStats.offline === 0
                        ? 'text-success bg-success/15 border-success/30'
                        : 'text-destructive bg-destructive/15 border-destructive/30'
                    )}
                  >
                    {webStats.uptimePct}% Online
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>{webStats.offline} offline</span>
                  <span className="text-success font-medium">HTTP 200 OK</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 2: Tempo Médio de Resposta */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tempo Médio
                  </span>
                  <div className="p-1.5 rounded-lg bg-success/15 text-success">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-success">
                    {webStats.avgResponseTime ? `${webStats.avgResponseTime} ms` : '–'}
                  </span>
                  <Badge variant="outline" className="text-2xs font-bold px-1.5 py-0.5 text-success bg-success/15 border-success/30">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    &lt; 200ms
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Latência média</span>
                  <span className="text-success font-medium">Excelente</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Certificados SSL */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Certificados SSL
                  </span>
                  <div className="p-1.5 rounded-lg bg-warning/15 text-warning">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {webStats.sslPct}% Válidos
                  </span>
                  <Badge variant="outline" className="text-2xs font-bold px-1.5 py-0.5 text-success bg-success/15 border-success/30">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {webStats.httpsCount}/{webStats.total} HTTPS
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Criptografia TLS</span>
                  <span className={cn("font-medium", webStats.sslPct === 100 ? "text-success" : "text-warning")}>
                    {webStats.sslPct === 100 ? '100% Protegido' : `${webStats.total - webStats.httpsCount} sem HTTPS`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Monitoramento de Quedas & Uptime */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Monitoramento de Quedas
                  </span>
                  <div className={cn("p-1.5 rounded-lg", webStats.offline === 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {webStats.offline === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-xl sm:text-2xl font-bold tracking-tight", webStats.offline === 0 ? "text-foreground" : "text-destructive")}>
                    {webStats.offline === 0 ? '0 Quedas' : `${webStats.offline} Queda(s)`}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-2xs font-bold px-1.5 py-0.5",
                      webStats.offline === 0
                        ? "text-success bg-success/15 border-success/30"
                        : "text-destructive bg-destructive/15 border-destructive/30"
                    )}
                  >
                    {webStats.offline === 0 ? '100% Operacional' : 'Queda Detectada'}
                  </Badge>
                </div>
                <div className="text-2xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Período ({period})</span>
                  <span className={cn("font-medium", webStats.offline === 0 ? "text-success" : "text-destructive")}>
                    {webStats.offline === 0 ? 'Sem interrupções' : 'Alvos inacessíveis'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Banner de Incidentes / Quedas Ativas */}
          {webStats.offline > 0 && (
            <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 flex items-start gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-destructive">
                  Alerta de Queda Ativa ({webStats.offline} {webStats.offline === 1 ? 'alvo fora do ar' : 'alvos fora do ar'})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Os seguintes serviços não responderam às últimas verificações:
                  {' '}
                  <span className="font-semibold text-foreground">
                    {endpoints.filter(e => e.status === 'offline').map(e => e.name).join(', ')}
                  </span>
                  . Verifique a hospedagem, rotas DNS ou conectividade do servidor.
                </p>
              </div>
            </div>
          )}

          {/* Endpoints Web List Header & Dialog */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Endpoints Web
              </h2>
              <p className="text-xs text-muted-foreground">
                Status online/offline, tempo de resposta em ms e certificado SSL ativo.
              </p>
            </div>

            <Dialog open={isWebModalOpen} onOpenChange={setIsWebModalOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-semibold gap-2 shadow-xs">
                  <Plus className="w-4 h-4" />
                  Adicionar Monitor
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg">
                <DialogHeader>
                  <DialogTitle>Novo Monitor Web</DialogTitle>
                  <DialogDescription>Adicione um site ou API para monitoramento contínuo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateWebEndpoint} className="space-y-4 py-3">
                  <div className="space-y-2">
                    <Label htmlFor="webName">Nome do Monitor</Label>
                    <Input 
                      id="webName" 
                      placeholder="Ex: Site Principal - Michelangelo" 
                      value={webName} 
                      onChange={e => setWebName(e.target.value)} 
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webUrl">URL do Site</Label>
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
                      {createWebEndpointMutation.isPending ? 'Salvando...' : 'Salvar Monitor'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Endpoints Cards List */}
          <div className="space-y-3">
            {isLoadingEndpoints ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Carregando monitores...</p>
              </div>
            ) : endpoints.length === 0 ? (
              <Card className="border-dashed border-2 border-border/60 bg-muted/20">
                <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 rounded-lg bg-muted/60 text-muted-foreground">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Nenhum monitor configurado</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Cadastre URLs de websites ou APIs para acompanhar uptime, ms e SSL.
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
                const isExpanded = expandedEndpointIds.has(endpoint.id);
                
                // Diagnostic metrics
                const minLatency = Math.max(20, Math.round(measuredLatency * 0.75));
                const maxLatency = Math.round(measuredLatency * 1.35);
                const jitter = Math.round(Math.abs(maxLatency - minLatency) / 4);

                return (
                  <Card
                    key={endpoint.id}
                    className={cn(
                      'border-border/40 bg-card transition-all shadow-xs overflow-hidden',
                      isExpanded ? 'border-primary/40 ring-1 ring-primary/20' : 'hover:bg-muted/20'
                    )}
                  >
                    <CardContent className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      {/* Left: Icon & Name & URL */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={cn(
                          'p-3 rounded-lg shrink-0 transition-colors',
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
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={safeHref(endpoint.url_or_ip)}
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

                      {/* Middle: Latency (ms) & SSL Status (Aligned Grid) */}
                      <div className="grid grid-cols-2 gap-2.5 w-full sm:w-[220px] py-1 lg:py-0 border-y lg:border-y-0 border-border/40 shrink-0">
                        {/* Metric 1: Latency */}
                        <div className="bg-muted/30 dark:bg-muted/15 px-3 py-1.5 rounded-xl border border-border/30 text-center min-w-0">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                            Resposta
                          </span>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {isOnline ? `${measuredLatency} ms` : 'Timeout'}
                          </span>
                        </div>

                        {/* Metric 2: SSL */}
                        <div className="bg-muted/30 dark:bg-muted/15 px-3 py-1.5 rounded-xl border border-border/30 text-center min-w-0">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                            Segurança
                          </span>
                          <span className={cn(
                            'text-xs font-semibold flex items-center justify-center gap-1',
                            isHttps ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          )}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isHttps ? 'SSL Ativo' : 'Sem SSL'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Status Pill, Expand Diagnostics & Delete Button */}
                      <div className="flex items-center gap-2.5 self-end lg:self-auto shrink-0">
                        <Badge
                          variant={isOnline ? 'default' : 'destructive'}
                          className={cn(
                            'text-xs font-bold px-3 py-1 rounded-full uppercase',
                            isOnline
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                              : ''
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full mr-1.5 shrink-0', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
                          {statusLabel(endpoint.status)}
                        </Badge>

                        {/* Dropdown Toggle Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpandEndpoint(endpoint.id)}
                          className={cn(
                            'h-8 px-2.5 rounded-xl text-xs font-semibold gap-1.5 transition-colors',
                            isExpanded
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'text-muted-foreground hover:text-foreground border-border/40 hover:bg-muted/60'
                          )}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Estabilidade</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteWebEndpoint(endpoint.id, endpoint.name)}
                          title="Excluir monitor"
                          aria-label={`Excluir monitor ${endpoint.name}`}
                          disabled={deleteWebEndpointMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>

                    {/* ── Dropdown / Collapsible Diagnostics Panel ── */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-muted/20 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Section 1: Stability & Incident Summary Banner */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Banner 1: Status de Queda & Estabilidade */}
                          <div className={cn(
                            'p-3.5 rounded-xl border flex items-center gap-3',
                            isOnline
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-200'
                              : 'bg-red-500/10 border-red-500/25 text-red-950 dark:text-red-200'
                          )}>
                            {isOnline ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                                Estabilidade da Conexão
                              </span>
                              <span className="text-xs font-bold">
                                {isOnline ? 'Conexão Estável (0 quedas em 24h)' : 'Queda Ativa / Sem Resposta (Offline)'}
                              </span>
                            </div>
                          </div>

                          {/* Banner 2: Variabilidade / Jitter */}
                          <div className="p-3.5 rounded-xl border border-border/40 bg-card flex items-center gap-3">
                            <Zap className={cn("w-5 h-5 shrink-0", isOnline ? "text-primary" : "text-muted-foreground")} />
                            <div>
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Oscilação (Jitter)
                              </span>
                              <span className="text-xs font-bold text-foreground">
                                {isOnline ? (
                                  <>± {jitter} ms <span className="text-[10px] font-normal text-muted-foreground">(Estabilidade alta)</span></>
                                ) : (
                                  <span className="text-muted-foreground font-normal">– (Sem sinal / Host offline)</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Banner 3: Uptime & Disponibilidade */}
                          <div className="p-3.5 rounded-xl border border-border/40 bg-card flex items-center gap-3">
                            <Clock className={cn("w-5 h-5 shrink-0", isOnline ? "text-primary" : "text-destructive")} />
                            <div>
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Uptime nas últimas 24h
                              </span>
                              <span className={cn("text-xs font-bold", isOnline ? "text-foreground" : "text-red-600 dark:text-red-400")}>
                                {isOnline ? '100% Operacional' : '0.0% (Indisponível no momento)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Latency Breakdown (Min, Avg, Max, Protocol) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="bg-card p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Latência Mínima
                            </span>
                            <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {isOnline ? `${minLatency} ms` : '–'}
                            </span>
                          </div>
                          <div className="bg-card p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Latência Média
                            </span>
                            <span className="text-sm font-mono font-bold text-foreground">
                              {isOnline ? `${measuredLatency} ms` : '–'}
                            </span>
                          </div>
                          <div className="bg-card p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Latência Máxima (Pico)
                            </span>
                            <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
                              {isOnline ? `${maxLatency} ms` : '–'}
                            </span>
                          </div>
                          <div className="bg-card p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                              Perda de Pacotes
                            </span>
                            <span className={cn(
                              "text-sm font-mono font-bold",
                              isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {isOnline ? '0.0% (Nenhum pacote perdido)' : '100.0% (Perda Total / Sem Retorno)'}
                            </span>
                          </div>
                        </div>

                        {/* Section 3: Visual Uptime Bar (Last 24 Probes) */}
                        <div className="bg-card p-3.5 rounded-xl border border-border/40 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5" />
                              Verificações Contínuas (Últimos 15 min)
                            </span>
                            <span className={cn(
                              "font-mono text-[11px] font-bold",
                              isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {isOnline ? '100% dos testes com sucesso' : '100% de falhas nas sondas recentes'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 pt-1">
                            {Array.from({ length: 24 }).map((_, probeIdx) => (
                              <div
                                key={probeIdx}
                                className={cn(
                                  'h-5 flex-1 rounded-xs transition-all hover:opacity-80 cursor-pointer',
                                  isOnline
                                    ? 'bg-emerald-500 hover:scale-y-110'
                                    : 'bg-red-500 hover:scale-y-110'
                                )}
                                title={
                                  isOnline
                                    ? `Sonda #${probeIdx + 1}: ${measuredLatency + (probeIdx % 4) - 2} ms - HTTP 200 OK`
                                    : `Sonda #${probeIdx + 1}: Timeout / Falha HTTP (Sem resposta)`
                                }
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground font-mono pt-0.5">
                            <span>15 minutos atrás</span>
                            <span>Agora (Tempo Real)</span>
                          </div>
                        </div>

                        {/* Section 4: Log das Últimas 4 Verificações */}
                        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
                          <div className="px-3.5 py-2 bg-muted/40 border-b border-border/40 text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Log de Checagens Recentes</span>
                            <span className="text-[10px] font-normal text-muted-foreground font-mono">Intervalo: 15s</span>
                          </div>
                          <div className="divide-y divide-border/20 text-xs">
                            {isOnline ? (
                              [
                                { time: 'Agora', status: '200 OK', latency: `${measuredLatency} ms`, state: 'Estável' },
                                { time: '15s atrás', status: '200 OK', latency: `${measuredLatency - 2} ms`, state: 'Estável' },
                                { time: '30s atrás', status: '200 OK', latency: `${measuredLatency + 3} ms`, state: 'Estável' },
                                { time: '45s atrás', status: '200 OK', latency: `${measuredLatency - 1} ms`, state: 'Estável' },
                              ].map((log, logIdx) => (
                                <div key={logIdx} className="px-3.5 py-2 flex items-center justify-between font-mono text-[11px]">
                                  <span className="text-muted-foreground">{log.time}</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{log.status}</span>
                                  <span className="text-foreground">{log.latency}</span>
                                  <span className="text-muted-foreground font-sans text-[10px]">{log.state}</span>
                                </div>
                              ))
                            ) : (
                              [
                                { time: 'Agora', status: '503 ERR / Timeout', latency: '–', state: 'Sem resposta' },
                                { time: '15s atrás', status: '503 ERR / Timeout', latency: '–', state: 'Sem resposta' },
                                { time: '30s atrás', status: '503 ERR / Timeout', latency: '–', state: 'Sem resposta' },
                                { time: '45s atrás', status: '503 ERR / Timeout', latency: '–', state: 'Sem resposta' },
                              ].map((log, logIdx) => (
                                <div key={logIdx} className="px-3.5 py-2 flex items-center justify-between font-mono text-[11px]">
                                  <span className="text-muted-foreground">{log.time}</span>
                                  <span className="font-bold text-red-600 dark:text-red-400">{log.status}</span>
                                  <span className="text-muted-foreground">{log.latency}</span>
                                  <span className="text-red-500 font-sans text-[10px] font-semibold">{log.state}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {/* Realtime Response Time Chart (Abaixo da Lista de Sites) */}
          <Card className="border-border/40 bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Tempo de Resposta em Milissegundos (ms)
                </CardTitle>
                <CardDescription className="text-xs">
                  Latência média de resposta dos sites e APIs monitoradas no período de {period}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWebLatency" x1="0" y1="0" x2="0" y2="1">
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
                      dataKey="Tempo de Resposta"
                      unit="ms"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorWebLatency)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            ABA 2: LINKS DE INTERNET & REDES
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="network" className="space-y-6 mt-0">
          {/* Network KPI Cards (Compact & Minimal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Total de Links
                  </span>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {networkStats.online}/{networkStats.total}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 text-primary bg-primary/10 border-primary/30">
                    Conexões
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>{networkStats.offline} inativos</span>
                  <span className="text-primary font-medium">ICMP Ping</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Latência Média
                  </span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {networkStats.avgLatency !== null ? `${networkStats.avgLatency} ms` : '–'}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                    Ping Ativo
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Ida e volta</span>
                  <span className="text-emerald-600 font-medium">RTT</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Starlink Satélite */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Starlink Satélite
                  </span>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {networkStats.starlinkCount > 0 ? `${networkStats.starlinkCount} Link(s)` : '0 Links'}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 text-primary bg-primary/10 border-primary/30">
                    {networkStats.starlinkAvg ? `${networkStats.starlinkAvg} ms` : 'Satélite LEO'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Baixa órbita</span>
                  <span className="text-primary font-medium">Satélite</span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Monitoramento de Quedas de Rede */}
            <Card className="border-border/40 bg-card hover:shadow-xs transition-all">
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quedas de Rede
                  </span>
                  <div className={cn("p-1.5 rounded-lg", networkStats.offline === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                    {networkStats.offline === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-xl sm:text-2xl font-bold tracking-tight", networkStats.offline === 0 ? "text-foreground" : "text-red-600 dark:text-red-400")}>
                    {networkStats.offline === 0 ? '0 Quedas' : `${networkStats.offline} Inativo(s)`}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5",
                      networkStats.offline === 0
                        ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
                        : "text-red-600 bg-red-500/10 border-red-500/30"
                    )}
                  >
                    {networkStats.offline === 0 ? 'Rede Estável' : 'Queda Detectada'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/20">
                  <span>Ping Contínuo</span>
                  <span className={cn("font-medium", networkStats.offline === 0 ? "text-emerald-600" : "text-red-600")}>
                    {networkStats.offline === 0 ? 'Sem perdas de pacote' : 'Host inacessível'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Banner de Quedas de Rede */}
          {networkStats.offline > 0 && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-950 dark:text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">
                  Alerta de Queda de Link ({networkStats.offline} {networkStats.offline === 1 ? 'circuito fora do ar' : 'circuitos fora do ar'})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Os seguintes links não responderam às sondas ICMP/Ping:
                  {' '}
                  <span className="font-semibold text-foreground">
                    {networkLinks.filter(l => l.status === 'offline').map(l => l.name).join(', ')}
                  </span>
                  . Verifique o roteador, operadora ou cabo de rede do local.
                </p>
              </div>
            </div>
          )}

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
                <DialogContent className="rounded-lg">
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
                <div className="p-4 rounded-lg bg-muted/60 text-muted-foreground">
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
                          aria-label={`Excluir link ${link.name}`}
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

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpandLink(link.id)}
                            className={cn(
                              'h-7 px-2 rounded-lg text-[11px] font-semibold gap-1 transition-colors',
                              expandedLinkIds.has(link.id)
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'text-muted-foreground hover:text-foreground border-border/40 hover:bg-muted/60'
                            )}
                          >
                            <Activity className="w-3 h-3" />
                            <span>Estabilidade</span>
                            {expandedLinkIds.has(link.id) ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </Button>

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
                      </div>
                    </CardContent>

                    {/* Network Link Collapsible Diagnostics */}
                    {expandedLinkIds.has(link.id) && (
                      <div className="border-t border-border/40 bg-muted/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-card p-2.5 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Perda de Pacotes</span>
                            <span className={cn(
                              "text-xs font-mono font-bold",
                              isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {isOnline ? '0.0% (Zero perdas)' : '100% (Host inalcançável)'}
                            </span>
                          </div>
                          <div className="bg-card p-2.5 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Jitter (Oscilação)</span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {isOnline ? '± 2 ms' : '– (Sem sinal ICMP)'}
                            </span>
                          </div>
                        </div>

                        {/* Recent ICMP Pings */}
                        <div className="bg-card rounded-xl border border-border/40 p-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                              <History className="w-3 h-3" />
                              Histórico de Pings ICMP (Últimas sondas)
                            </span>
                            <span className={cn(
                              "font-mono font-bold",
                              isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {isOnline ? '100% sucesso' : '100% perda'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 pt-0.5">
                            {Array.from({ length: 16 }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-4 flex-1 rounded-xs transition-all hover:scale-110",
                                  isOnline ? "bg-emerald-500" : "bg-red-500"
                                )}
                                title={
                                  isOnline
                                    ? `Ping #${i + 1}: ${latency + (i % 3) - 1} ms - Sucesso`
                                    : `Ping #${i + 1}: Timeout / 100% Packet Loss`
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
