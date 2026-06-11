import React, { useState, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, HardDrive, Cpu, Monitor, Network,
  Terminal, Play, Info, Activity, RefreshCw, Copy, Trash2,
  Wifi, WifiOff, Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useMachineDetail,
  useMachineMetricsByPeriod,
  useMachineAlerts,
  useCreateCommand,
  useMachineCommands,
  useManagementCompanies,
  useUpdateMachine,
  useMonitoringGroups,
  pct,
} from '@/hooks/useMonitoring';
import type { MetricPeriod } from '@/hooks/useMonitoring';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserProfile } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import type { MachineWithMetric, CommandRow } from '@/hooks/useMonitoring';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MachineDrawerProps {
  machine: MachineWithMetric | null;
  open: boolean;
  onClose: () => void;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

function bytes(n: number | null): string {
  if (!n) return '–';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${n} B`;
}

function InfoRow({ label, value, icon: Icon }: { label: React.ReactNode; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex justify-between items-center py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold text-foreground text-right max-w-[60%] truncate">
        {value ?? '–'}
      </span>
    </div>
  );
}

// ── Custom Tooltip for chart ──────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-[11px] space-y-1">
      <p className="font-bold text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.dataKey}:</span>
          <span className="font-bold text-foreground">{p.value != null ? `${p.value}%` : '–'}</span>
        </div>
      ))}
    </div>
  );
};

// ── Terminal Command Row ──────────────────────────────────
function CommandEntry({ cmd, onCopy }: { cmd: CommandRow; onCopy: (text: string) => void }) {
  const hasPending = cmd.status === 'pending' || cmd.status === 'sent';
  return (
    <div className="space-y-1.5 group/cmd">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-green-500/70 pr-0.5">$</span>
        <span className="text-zinc-200 font-bold font-mono flex-1 break-all">{cmd.command}</span>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span className="text-[9px] text-zinc-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {format(new Date(cmd.created_at), 'HH:mm:ss')}
          </span>
          {cmd.executed_by_name && (
            <span className="text-[9px] text-indigo-400/60 font-mono">{cmd.executed_by_name}</span>
          )}
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase",
            cmd.status === 'completed' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
            cmd.status === 'failed' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
            'border-amber-500/30 text-amber-400 bg-amber-500/10 animate-pulse'
          )}>
            {hasPending ? '⏳ aguardando' : cmd.status}
          </span>
        </div>
      </div>
      {cmd.output && (
        <div className="relative">
          <pre className="text-[10px] text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/40 whitespace-pre-wrap leading-relaxed shadow-inner max-h-48 overflow-y-auto">
            {cmd.output}
          </pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover/cmd:opacity-100 transition-opacity hover:bg-zinc-700 text-zinc-400"
            onClick={() => onCopy(cmd.output!)}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export const MachineDrawer: React.FC<MachineDrawerProps> = ({ machine, open, onClose }) => {
  const machineId = machine?.id ?? null;
  const [activeTab, setActiveTab] = useState('overview');
  const [cmd, setCmd] = useState('');
  const [period, setPeriod] = useState<MetricPeriod>('24h');
  const [clearedBefore, setClearedBefore] = useState<string | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const { data: detail, isLoading: detailLoading } = useMachineDetail(machineId);
  const { data: metrics = [], isLoading: metricsLoading } = useMachineMetricsByPeriod(machineId, period);
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);
  const { data: allCommands = [], isLoading: commandsLoading } = useMachineCommands(machineId);
  const { data: profile } = useUserProfile();
  const createCommand = useCreateCommand();

  // Filter cleared commands
  const commands = clearedBefore
    ? allCommands.filter(c => c.created_at > clearedBefore)
    : allCommands;

  const hasPending = commands.some(c => c.status === 'pending' || c.status === 'sent');

  const hw = detail?.hardware;

  // Auto-scroll terminal when new commands arrive
  useEffect(() => {
    if (activeTab === 'actions') {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [commands.length, activeTab]);

  const handleRunCommand = async (customCmd?: string) => {
    const commandToRun = customCmd || cmd;
    if (!commandToRun.trim() || !machineId) return;
    if (hasPending) {
      toast.warning('Aguarde o comando anterior completar antes de enviar outro.');
      return;
    }
    try {
      await createCommand.mutateAsync({
        machineId,
        command: commandToRun,
        executed_by_user_id: profile?.id,
        executed_by_name: profile?.full_name ?? profile?.email ?? 'Técnico',
      });
      setCmd('');
      toast.success('Comando enfileirado com sucesso!');
    } catch (err: any) {
      toast.error(`Falha ao enviar comando: ${err.message}`);
    }
  };

  const handleCopyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Output copiado!');
  };

  const handleClearConsole = () => {
    setClearedBefore(new Date().toISOString());
  };

  const { data: role } = useUserRole();
  const { data: companies = [] } = useManagementCompanies();
  const { data: groups = [] } = useMonitoringGroups();
  const updateMachine = useUpdateMachine();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (machine) {
      setSelectedGroupId(machine.group_id || '');
      setSelectedCompanyId(machine.company_id || '');
      setClearedBefore(null);
    }
  }, [machine]);

  const canManage = role === 'admin' || role === 'developer' || role === 'gestor';

  const handleSaveChanges = async () => {
    if (!machineId) return;
    setIsSaving(true);
    try {
      await updateMachine.mutateAsync({
        id: machineId,
        updates: {
          group_id: selectedGroupId || '',
          company_id: selectedCompanyId || '',
        }
      });
      toast.success('Alterações salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const chartData = metrics
    .slice()
    .reverse()
    .map((m) => ({
      time: format(new Date(m.collected_at), period === '7d' ? 'dd/MM HH:mm' : 'HH:mm'),
      CPU: m.cpu_usage != null ? Math.round(m.cpu_usage) : null,
      RAM: pct(m.ram_used, m.ram_total),
      Disco: pct(m.disk_used, m.disk_total),
    }));

  const isOnline = machine?.status === 'online';

  // Connection LED color
  const ledColor = isOnline ? 'bg-green-400 shadow-green-400/60' : 'bg-red-400 shadow-red-400/60';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col border-l border-border/40 shadow-2xl">
        <SheetHeader className="px-6 py-6 border-b border-border/40 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Phase 2: Connection LED */}
              <div className="relative">
                <div className={cn('h-3.5 w-3.5 rounded-full shadow-lg', ledColor)} />
                {isOnline && <div className={cn('absolute inset-0 rounded-full animate-ping opacity-30', ledColor)} />}
              </div>
              <div>
                <SheetTitle className="text-xl font-bold tracking-tight">{machine?.hostname ?? 'Máquina Desconhecida'}</SheetTitle>
                <SheetDescription className="text-xs font-medium flex items-center gap-2 mt-0.5">
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">{machine?.ip_address}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">{machine?.os} {machine?.os_version}</span>
                </SheetDescription>
              </div>
            </div>
            {/* Online/Offline badge */}
            <Badge variant="outline" className={cn(
              'text-[10px] font-bold gap-1.5',
              isOnline ? 'text-green-600 border-green-500/30 bg-green-500/5' : 'text-red-500 border-red-500/30 bg-red-500/5'
            )}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 border-b border-border/40 bg-muted/5">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
              <TabsTrigger value="overview" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Resumo</TabsTrigger>
              <TabsTrigger value="inventory" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Inventário</TabsTrigger>
              <TabsTrigger value="actions" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Terminal</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* ── Tab: Overview ── */}
              <TabsContent value="overview" className="mt-0 space-y-8">
                {/* Status cards */}
                <section className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-4 bg-muted/20 border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">CPU</p>
                      <p className="text-2xl font-bold">{machine?.cpu_usage != null ? `${Math.round(machine.cpu_usage)}%` : '–'}</p>
                    </Card>
                    <Card className="p-4 bg-muted/20 border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">RAM</p>
                      <p className="text-2xl font-bold">{pct(machine?.ram_used ?? null, machine?.ram_total ?? null)}%</p>
                    </Card>
                    <Card className="p-4 bg-muted/20 border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Disco</p>
                      <p className="text-2xl font-bold">{pct(machine?.disk_used ?? null, machine?.disk_total ?? null)}%</p>
                    </Card>
                  </div>

                  <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
                    <InfoRow label="Visto pela última vez" value={machine?.last_seen ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR }) : '–'} />
                    <InfoRow label="Uptime do Sistema" value={machine?.uptime ? `${Math.floor(machine.uptime / 3600)}h ${Math.floor((machine.uptime % 3600) / 60)}m` : '–'} />
                    <InfoRow label="Agente Orion" value={`v${machine?.agent_version}`} />
                  </div>
                </section>

                {/* Phase 1: Performance Chart with period selector + disk line */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Desempenho Histórico
                    </h3>
                    {/* Period selector */}
                    <div className="flex gap-1">
                      {(['1h', '6h', '24h', '7d'] as MetricPeriod[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold transition-all border',
                            period === p
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Card className="p-4 border-border/40 bg-background shadow-sm">
                    {metricsLoading ? (
                      <Skeleton className="h-52 w-full" />
                    ) : chartData.length === 0 ? (
                      <div className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Info className="w-8 h-8 opacity-20" />
                        <p className="text-xs">Sem dados históricos para o período selecionado</p>
                      </div>
                    ) : (
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                              formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}>{value}</span>}
                            />
                            <Line type="monotone" dataKey="CPU" stroke="rgb(99, 102, 241)" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="RAM" stroke="rgb(16, 185, 129)" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="Disco" stroke="rgb(245, 158, 11)" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                </section>

                {/* Alerts */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Alertas Ativos</h3>
                    {alerts.length > 0 && <Badge variant="destructive" className="h-5 text-[9px] font-bold">{alerts.length}</Badge>}
                  </div>
                  {alertsLoading ? (
                    <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                  ) : alerts.length === 0 ? (
                    <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold">Nenhum problema detectado</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((alert) => (
                        <div key={alert.id} className={cn('rounded-xl border p-4 space-y-1 transition-all hover:translate-x-1', severityColor[alert.severity])}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-tight">{alert.severity}</span>
                            <span className="text-[9px] opacity-60">{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}</span>
                          </div>
                          <p className="text-xs font-medium leading-relaxed">{alert.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Admin section */}
                {canManage && (
                  <section className="space-y-4 pt-4">
                    <Separator className="border-border/20" />
                    <h3 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-1">Configurações Administrativas</h3>
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Grupo / Cliente</label>
                        <Select value={selectedGroupId || 'none'} onValueChange={(v) => setSelectedGroupId(v === 'none' ? '' : v)}>
                          <SelectTrigger className="bg-background border-indigo-500/20 rounded-xl"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Empresa</label>
                        <Select value={selectedCompanyId || 'none'} onValueChange={(v) => setSelectedCompanyId(v === 'none' ? '' : v)}>
                          <SelectTrigger className="bg-background border-indigo-500/20 rounded-xl"><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20" onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Salvar Alterações
                      </Button>
                    </div>
                  </section>
                )}
              </TabsContent>

              {/* ── Tab: Inventory ── */}
              <TabsContent value="inventory" className="mt-0 space-y-8">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Hardware Base</h3>
                  <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
                    <InfoRow icon={Cpu} label="Processador" value={hw?.cpu_model} />
                    <InfoRow icon={Monitor} label="Gráficos (GPU)" value={hw?.gpu} />
                    <InfoRow icon={HardDrive} label="Memória Total" value={bytes(machine?.ram_total ?? null)} />
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Armazenamento & Partições</h3>
                  <div className="space-y-3">
                    {Array.isArray(hw?.disks) && hw.disks.length > 0 ? (
                      hw.disks.map((d: any, idx: number) => (
                        <Card key={idx} className="p-4 border-border/40 bg-muted/5 shadow-none">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-4 h-4 text-primary" />
                              <span className="text-xs font-bold">{d.mountpoint}</span>
                            </div>
                            <span className="text-[10px] bg-background px-2 py-0.5 rounded border border-border/40 text-muted-foreground">{d.fs_type}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn('h-full transition-all rounded-full', pct(d.used, d.total) > 90 ? 'bg-red-500' : pct(d.used, d.total) > 70 ? 'bg-amber-500' : 'bg-primary')}
                                style={{ width: `${pct(d.used, d.total)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-muted-foreground">Uso: {bytes(d.used)}</span>
                              <span className={cn('font-bold', pct(d.used, d.total) > 90 ? 'text-red-500' : 'text-foreground')}>{pct(d.used, d.total)}% de {bytes(d.total)}</span>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-4">Sem informações de partições detalhadas.</p>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Interfaces de Rede</h3>
                  <div className="space-y-2">
                    {Array.isArray(hw?.network_interfaces) && hw.network_interfaces.length > 0 ? (
                      hw.network_interfaces.map((iface: any, idx: number) => (
                        <div key={idx} className="bg-muted/10 border border-border/40 rounded-xl p-4 transition-all hover:bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Network className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-bold">{iface.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground">{iface.mac}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {iface.ips?.map((ip: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[9px] font-mono bg-background/50">{ip}</Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-4">Dados de rede indisponíveis.</p>
                    )}
                  </div>
                </section>
              </TabsContent>

              {/* ── Tab: Terminal (Phase 2) ── */}
              <TabsContent value="actions" className="mt-0 space-y-6">
                <section className="space-y-4">
                  {/* Terminal header with connection status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-xl', isOnline ? 'bg-green-500/10' : 'bg-red-500/10')}>
                        <Terminal className={cn('w-5 h-5', isOnline ? 'text-green-600' : 'text-red-500')} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Terminal Remoto</h4>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
                          {isOnline ? 'Agente conectado — pronto para receber comandos' : 'Agente offline — comandos ficam na fila'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preset commands */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">Comandos Rápidos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Flush DNS', cmd: 'ipconfig /flushdns', icon: Network },
                        { label: 'Conexões Ativas', cmd: 'netstat -an', icon: Activity },
                        { label: 'Ver Processos', cmd: 'tasklist', icon: Cpu },
                        { label: 'Forçar GPO', cmd: 'gpupdate /force', icon: RefreshCw },
                        { label: 'Info do Sistema', cmd: 'systeminfo', icon: Monitor },
                        { label: 'Verificar Disco', cmd: 'chkdsk C:', icon: HardDrive },
                      ].map(({ label, cmd: presetCmd, icon: Icon }) => (
                        <Button
                          key={label}
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => handleRunCommand(presetCmd)}
                          disabled={createCommand.isPending || hasPending}
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Command input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: ping 8.8.8.8 ou ipconfig /all"
                      value={cmd}
                      onChange={(e) => setCmd(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
                      disabled={hasPending}
                      className="bg-muted/20 border-border/40 font-mono text-xs"
                    />
                    <Button
                      className="font-bold gap-2 px-5"
                      onClick={() => handleRunCommand()}
                      disabled={createCommand.isPending || !cmd.trim() || hasPending}
                    >
                      {hasPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {hasPending ? 'Aguardando...' : 'Rodar'}
                    </Button>
                  </div>

                  <Separator className="border-border/20" />

                  {/* Console output */}
                  <div className="bg-[#0d0d0f] rounded-xl font-mono text-[11px] overflow-hidden flex flex-col border border-zinc-800/80 shadow-2xl">
                    {/* Terminal chrome */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-900/50">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 hover:bg-red-500 transition-colors cursor-pointer" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 hover:bg-yellow-500 transition-colors cursor-pointer" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 hover:bg-green-500 transition-colors cursor-pointer" />
                        </div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                          {machine?.hostname ?? 'Console'} — Orion Shell
                        </span>
                      </div>
                      <button
                        onClick={handleClearConsole}
                        className="flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Limpar
                      </button>
                    </div>

                    {/* Output area */}
                    <div className="flex-1 overflow-y-auto max-h-[360px] p-4 space-y-4 custom-scrollbar">
                      {commandsLoading ? (
                        <div className="text-zinc-600 animate-pulse text-center py-8">Sincronizando logs...</div>
                      ) : commands.length === 0 ? (
                        <div className="text-center py-8 space-y-2">
                          <p className="text-zinc-600 italic text-[10px]"># Terminal pronto. Aguardando entrada...</p>
                          <p className="text-zinc-700 text-[9px]">Digite um comando acima ou use os atalhos rápidos.</p>
                        </div>
                      ) : (
                        commands.map((c) => (
                          <CommandEntry key={c.id} cmd={c} onCopy={handleCopyOutput} />
                        ))
                      )}
                      <div ref={consoleEndRef} />
                    </div>
                  </div>
                </section>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
