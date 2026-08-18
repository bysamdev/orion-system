import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Activity,
  ExternalLink,
  RefreshCw,
  Settings,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Radio,
  Sliders,
  Tv,
  Info,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

export type TelemetryPeriod = '15m' | '1h' | '6h' | '24h' | '7d' | '30d';

export interface GrafanaTelemetryViewProps {
  hostname?: string;
  machineId?: string;
  className?: string;
  initialPeriod?: TelemetryPeriod;
  dashboardPath?: string;
  height?: string | number;
  isNocMode?: boolean;
  title?: string;
}

const DEFAULT_GRAFANA_URL = 'http://192.168.1.200:3000';
const STORAGE_KEY_URL = 'orion_grafana_base_url';
const STORAGE_KEY_PATH = 'orion_grafana_dashboard_path';

const PERIOD_LABELS: Record<TelemetryPeriod, string> = {
  '15m': '15 min',
  '1h': '1 hora',
  '6h': '6 horas',
  '24h': '24 horas',
  '7d': '7 dias',
  '30d': '30 dias',
};

const REFRESH_OPTIONS = [
  { label: 'Desativado', value: 'off' },
  { label: '5 segundos', value: '5s' },
  { label: '10 segundos', value: '10s' },
  { label: '30 segundos', value: '30s' },
  { label: '1 minuto', value: '1m' },
  { label: '5 minutos', value: '5m' },
];

export const GrafanaTelemetryView: React.FC<GrafanaTelemetryViewProps> = ({
  hostname,
  machineId,
  className,
  initialPeriod = '1h',
  dashboardPath: initialDashboardPath,
  height,
  isNocMode = false,
  title,
}) => {
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [period, setPeriod] = useState<TelemetryPeriod>(initialPeriod);
  const [refreshInterval, setRefreshInterval] = useState<string>('10s');
  const [kioskMode, setKioskMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [lastCheckMessage, setLastCheckMessage] = useState<string>('');

  // Base URL resolution
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_URL);
    if (saved) return saved.replace(/\/+$/, '');
    const envUrl = (import.meta as any).env?.VITE_GRAFANA_URL;
    if (envUrl) return envUrl.replace(/\/+$/, '');
    return DEFAULT_GRAFANA_URL;
  });

  const [customPath, setCustomPath] = useState<string>(() => {
    if (initialDashboardPath) return initialDashboardPath;
    const saved = localStorage.getItem(STORAGE_KEY_PATH);
    return saved || '';
  });

  // Temp settings for config popover
  const [tempUrl, setTempUrl] = useState(baseUrl);
  const [tempPath, setTempPath] = useState(customPath);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Construct Grafana URL
  const grafanaSrc = useMemo(() => {
    let cleanBase = baseUrl.trim().replace(/\/+$/, '');
    if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
      cleanBase = `http://${cleanBase}`;
    }

    let path = customPath.trim();
    if (path && !path.startsWith('/')) {
      path = `/${path}`;
    }

    const url = new URL(path || '/', cleanBase);
    
    // Theme
    url.searchParams.set('theme', resolvedTheme === 'dark' ? 'dark' : 'light');
    
    // Time period
    url.searchParams.set('from', `now-${period}`);
    url.searchParams.set('to', 'now');

    // Auto-refresh
    if (refreshInterval && refreshInterval !== 'off') {
      url.searchParams.set('refresh', refreshInterval);
    } else {
      url.searchParams.delete('refresh');
    }

    // Kiosk embed mode
    if (kioskMode) {
      url.searchParams.set('kiosk', 'tv');
    } else {
      url.searchParams.delete('kiosk');
    }

    // Filter variables for Prometheus / Node Exporter / Host metrics
    if (hostname) {
      url.searchParams.set('var-node', hostname);
      url.searchParams.set('var-hostname', hostname);
      url.searchParams.set('var-instance', hostname);
      url.searchParams.set('var-host', hostname);
    }
    if (machineId) {
      url.searchParams.set('var-machine_id', machineId);
    }

    return url.toString();
  }, [baseUrl, customPath, resolvedTheme, period, refreshInterval, kioskMode, hostname, machineId]);

  // Test Grafana connectivity
  const handleTestConnection = async (targetUrl = baseUrl) => {
    setConnectionStatus('checking');
    setLastCheckMessage('Testando conectividade com o servidor Grafana...');
    
    let cleanBase = targetUrl.trim().replace(/\/+$/, '');
    if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
      cleanBase = `http://${cleanBase}`;
    }

    try {
      // Try to fetch health status or ping with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // mode: 'no-cors' allows detecting if network packet reaches the server even without CORS headers
      await fetch(`${cleanBase}/api/health`, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setConnectionStatus('ok');
      setLastCheckMessage(`Servidor ${cleanBase} está respondendo!`);
      toast.success(`Conexão com Grafana (${cleanBase}) estabelecida!`);
    } catch (err: any) {
      setConnectionStatus('error');
      const isAbort = err.name === 'AbortError';
      const msg = isAbort
        ? `Tempo limite esgotado ao conectar em ${cleanBase}`
        : `Não foi possível alcançar ${cleanBase}. Verifique se o serviço está rodando e a porta está liberada.`;
      setLastCheckMessage(msg);
      toast.error('Falha na comunicação com o Grafana');
    }
  };

  const handleSaveSettings = () => {
    let clean = tempUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    localStorage.setItem(STORAGE_KEY_URL, clean);
    localStorage.setItem(STORAGE_KEY_PATH, tempPath.trim());
    setBaseUrl(clean);
    setCustomPath(tempPath.trim());
    setIsSettingsOpen(false);
    setIframeKey(k => k + 1);
    toast.success('Configurações do Grafana salvas com sucesso!');
  };

  const handleReload = () => {
    setIsLoadingIframe(true);
    setIframeKey(k => k + 1);
  };

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Erro ao alternar tela cheia:', err);
    }
  };

  const handleOpenExternal = () => {
    window.open(grafanaSrc, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col w-full rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm transition-all',
        isFullscreen ? 'p-4 fixed inset-0 z-50 rounded-none bg-background' : '',
        className
      )}
    >
      {/* ── Top Bar Controls ── */}
      <div className="p-3 sm:p-4 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Title & Target Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-tight">
            <Activity className="w-4 h-4 animate-pulse text-primary" />
            <span>{title || (isNocMode ? 'Telemetria Geral NOC (Grafana)' : 'Métricas em Tempo Real')}</span>
          </div>

          {hostname ? (
            <Badge variant="secondary" className="gap-1.5 font-mono text-[11px] bg-primary/10 text-primary border-primary/20">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              {hostname}
            </Badge>
          ) : isNocMode ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-bold text-indigo-500 border-indigo-500/30 bg-indigo-500/10">
              <Layers className="w-3 h-3" />
              Consolidado Multi-Host
            </Badge>
          ) : null}

          {connectionStatus === 'ok' && (
            <Badge variant="outline" className="gap-1 text-[10px] text-green-600 border-green-500/30 bg-green-500/10">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </Badge>
          )}

          {connectionStatus === 'error' && (
            <Badge variant="outline" className="gap-1 text-[10px] text-red-500 border-red-500/30 bg-red-500/10">
              <AlertTriangle className="w-3 h-3" /> Inacessível
            </Badge>
          )}
        </div>

        {/* Right: Controls (Period, Refresh, Kiosk, Fullscreen, Config) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
          <div className="flex items-center bg-background/80 border border-border/60 rounded-xl p-0.5 shadow-xs">
            {(['15m', '1h', '6h', '24h', '7d', '30d'] as TelemetryPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2 py-1 text-[11px] font-bold rounded-lg transition-all',
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                title={`Período: ${PERIOD_LABELS[p]}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Refresh Select */}
          <Select value={refreshInterval} onValueChange={setRefreshInterval}>
            <SelectTrigger className="h-8 text-xs rounded-xl bg-background/80 border-border/60 w-[105px] px-2">
              <SelectValue placeholder="Auto-refresh" />
            </SelectTrigger>
            <SelectContent>
              {REFRESH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Kiosk Mode Toggle */}
          <Button
            variant={kioskMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setKioskMode(!kioskMode)}
            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 font-medium hidden sm:flex"
            title="Alternar Modo Kiosk (Oculta menus do Grafana)"
          >
            <Tv className="w-3.5 h-3.5" />
            {kioskMode ? 'Kiosk On' : 'Kiosk Off'}
          </Button>

          {/* Reload Iframe */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleReload}
            className="h-8 w-8 rounded-xl"
            title="Recarregar Visualização"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoadingIframe && 'animate-spin')} />
          </Button>

          {/* Fullscreen */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleFullscreen}
            className="h-8 w-8 rounded-xl hidden sm:flex"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          {/* External Link */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenExternal}
            className="h-8 w-8 rounded-xl text-primary hover:text-primary"
            title="Abrir diretamente no Grafana"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>

          {/* Settings Popover */}
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                title="Configurações do Servidor Grafana"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 sm:w-96 p-4 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  <span className="font-bold text-xs uppercase tracking-wider">Configurar Grafana</span>
                </div>
                <Badge variant="outline" className="text-[9px]">v1.0</Badge>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">URL Base do Grafana</Label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 h-9 text-xs rounded-xl"
                      placeholder="http://192.168.1.200:3000"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTempUrl('https://monitor-orion.bysam.dev')}
                      className="px-2 py-1 text-[10px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary rounded-lg border border-primary/20 transition-all"
                    >
                      🌐 monitor-orion.bysam.dev
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempUrl('http://192.168.1.200:3000')}
                      className="px-2 py-1 text-[10px] font-semibold bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg border border-border/40 transition-all"
                    >
                      🏠 IP Local (192.168.1.200)
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    IP ou endereço DNS onde o Grafana está hospedado.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Caminho do Dashboard (Opcional)</Label>
                  <Input
                    className="h-9 text-xs rounded-xl"
                    placeholder="/d/orion-nodes/telemetry"
                    value={tempPath}
                    onChange={(e) => setTempPath(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Deixe em branco para usar a página inicial ou insira o UID/slug do dashboard.
                  </p>
                </div>

                {lastCheckMessage && (
                  <div className={cn(
                    'p-2.5 rounded-xl text-[11px] flex items-start gap-2 border',
                    connectionStatus === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' :
                    connectionStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
                    'bg-muted/40 border-border/40 text-muted-foreground'
                  )}>
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{lastCheckMessage}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs rounded-xl font-semibold"
                    onClick={() => handleTestConnection(tempUrl)}
                    disabled={connectionStatus === 'checking'}
                  >
                    <Activity className={cn('w-3.5 h-3.5 mr-1.5', connectionStatus === 'checking' && 'animate-spin')} />
                    Testar Conexão
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs rounded-xl font-bold"
                    onClick={handleSaveSettings}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Main Iframe View Area ── */}
      <div
        className="relative w-full flex-1 min-h-[380px] bg-muted/10 overflow-hidden"
        style={{ height: isFullscreen ? 'calc(100vh - 80px)' : (height || '540px') }}
      >
        {/* Loading Overlay */}
        {isLoadingIframe && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-3">
            <RefreshCw className="w-7 h-7 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-xs font-bold">Carregando telemetria do Grafana...</p>
              <p className="text-[10px] text-muted-foreground font-mono">{baseUrl}</p>
            </div>
          </div>
        )}

        {/* Embedded Iframe */}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={grafanaSrc}
          title={`Grafana Telemetry - ${hostname || 'Cluster'}`}
          className="w-full h-full border-none transition-opacity duration-300"
          onLoad={() => setIsLoadingIframe(false)}
          onError={() => {
            setIsLoadingIframe(false);
            setConnectionStatus('error');
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />

        {/* Inaccessible / Fallback Floating Helper Banner if connection failed */}
        {connectionStatus === 'error' && (
          <div className="absolute inset-x-4 bottom-4 z-20 p-4 bg-background/95 backdrop-blur-md border border-red-500/30 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  Servidor Grafana aparentemente inacessível ({baseUrl})
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Caso o Grafana bloqueie incorporação (iframe), certifique-se de definir <code className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">allow_embedding = true</code> no seu <code className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">grafana.ini</code>, ou abra diretamente em nova aba.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl font-semibold"
                onClick={() => handleTestConnection()}
              >
                Tentar Novamente
              </Button>
              <Button
                size="sm"
                className="text-xs rounded-xl font-bold gap-1.5"
                onClick={handleOpenExternal}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir Grafana
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Info bar ── */}
      <div className="px-4 py-2 border-t border-border/30 bg-muted/10 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-muted-foreground/70" />
            <span className="font-mono text-[10px] truncate max-w-[200px] sm:max-w-none">{baseUrl}</span>
          </span>
          <span className="text-muted-foreground/40 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Período: <strong className="text-foreground">{PERIOD_LABELS[period]}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Auto-refresh: <strong className="text-foreground">{refreshInterval}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default GrafanaTelemetryView;
