import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { AlertTriangle, CheckCircle2, HardDrive, Cpu, Monitor, Network, Package, Terminal, Play, Info, Activity, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useMachineDetail,
  useMachineMetrics,
  useMachineAlerts,
  useCreateCommand,
  useMachineCommands,
  pct,
} from '@/hooks/useMonitoring';
import { toast } from 'sonner';
import type { MachineWithMetric } from '@/hooks/useMonitoring';
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

export const MachineDrawer: React.FC<MachineDrawerProps> = ({ machine, open, onClose }) => {
  const machineId = machine?.id ?? null;
  const [activeTab, setActiveTab] = useState('overview');
  const [cmd, setCmd] = useState('');

  const { data: detail, isLoading: detailLoading } = useMachineDetail(machineId);
  const { data: metrics = [], isLoading: metricsLoading } = useMachineMetrics(machineId, 288);
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);
  const { data: commands = [], isLoading: commandsLoading } = useMachineCommands(machineId);
  const createCommand = useCreateCommand();

  const hw = detail?.hardware;

  const handleRunCommand = async (customCmd?: string) => {
    const commandToRun = customCmd || cmd;
    if (!commandToRun.trim() || !machineId) return;

    try {
      await createCommand.mutateAsync({ machineId, command: commandToRun });
      setCmd('');
      toast.success("Comando enfileirado com sucesso!");
    } catch (err: any) {
      toast.error(`Falha ao enviar comando: ${err.message}`);
    }
  };

  const chartData = metrics
    .slice()
    .reverse()
    .map((m) => ({
      time: format(new Date(m.collected_at), 'HH:mm'),
      CPU: m.cpu_usage != null ? Math.round(m.cpu_usage) : null,
      RAM: pct(m.ram_used, m.ram_total),
    }));

  const isOnline = machine?.status === 'online';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col border-l border-border/40 shadow-2xl">
        <SheetHeader className="px-6 py-6 border-b border-border/40 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-3.5 w-3.5 rounded-full shadow-[0_0_8px_rgba(var(--status-color),0.5)]',
                isOnline ? 'bg-green-500' : 'bg-red-500'
              )} />
              <div>
                <SheetTitle className="text-xl font-bold tracking-tight">{machine?.hostname ?? 'Máquina Desconhecida'}</SheetTitle>
                <SheetDescription className="text-xs font-medium flex items-center gap-2 mt-0.5">
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">{machine?.ip_address}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">{machine?.os} {machine?.os_version}</span>
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 border-b border-border/40 bg-muted/5">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
              <TabsTrigger value="overview" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Resumo</TabsTrigger>
              <TabsTrigger value="inventory" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Inventário</TabsTrigger>
              <TabsTrigger value="actions" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider">Ações</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="overview" className="mt-0 space-y-8">
                {/* Status Section */}
                <section className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 bg-muted/20 border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">CPU</p>
                      <p className="text-2xl font-bold">{machine?.cpu_usage != null ? `${Math.round(machine.cpu_usage)}%` : '–'}</p>
                    </Card>
                    <Card className="p-4 bg-muted/20 border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">RAM</p>
                      <p className="text-2xl font-bold">{pct(machine?.ram_used ?? null, machine?.ram_total ?? null)}%</p>
                    </Card>
                  </div>

                  <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
                    <InfoRow label="Visto pela última vez" value={machine?.last_seen ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR }) : '–'} />
                    <InfoRow label="Uptime do Sistema" value={machine?.uptime ? `${Math.floor(machine.uptime / 3600)}h ${Math.floor((machine.uptime % 3600) / 60)}m` : '–'} />
                    <InfoRow label="Agente Orion" value={`v${machine?.agent_version}`} />
                  </div>
                </section>

                {/* Charts */}
                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Desempenho (24h)</h3>
                  <Card className="p-6 border-border/40 bg-background shadow-sm">
                    {metricsLoading ? (
                      <Skeleton className="h-44 w-full" />
                    ) : chartData.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Info className="w-8 h-8 opacity-20" />
                        <p className="text-xs">Sem dados históricos</p>
                      </div>
                    ) : (
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }}
                            />
                            <Line type="monotone" dataKey="CPU" stroke="rgb(99, 102, 241)" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="RAM" stroke="rgb(16, 185, 129)" strokeWidth={2} dot={false} isAnimationActive={false} />
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
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
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
              </TabsContent>

              <TabsContent value="inventory" className="mt-0 space-y-8">
                {/* Hardware */}
                <section className="space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Hardware Base</h3>
                  <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
                    <InfoRow icon={Cpu} label="Processador" value={hw?.cpu_model} />
                    <InfoRow icon={Monitor} label="Gráficos (GPU)" value={hw?.gpu} />
                    <InfoRow icon={HardDrive} label="Memória Total" value={bytes(machine?.ram_total ?? null)} />
                  </div>
                </section>

                {/* Storage Partitions */}
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
                              <div className="h-full bg-primary transition-all" style={{ width: `${pct(d.used, d.total)}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-muted-foreground">Uso: {bytes(d.used)}</span>
                              <span className="text-foreground">{pct(d.used, d.total)}% de {bytes(d.total)}</span>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-4">Sem informações de partições detalhadas.</p>
                    )}
                  </div>
                </section>

                {/* Network Interfaces */}
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

              <TabsContent value="actions" className="mt-0 space-y-8">
                <section className="space-y-6">
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto">
                      <Terminal className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base">Terminal Remoto</h4>
                      <p className="text-xs text-muted-foreground mt-1 px-4 leading-relaxed">
                        Execute comandos diretamente no agente Orion. Os resultados aparecerão instantaneamente no log.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ex: ping 8.8.8.8 ou ls -la" 
                        value={cmd}
                        onChange={(e) => setCmd(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
                        className="bg-muted/20 border-border/40 font-mono text-xs"
                      />
                      <Button 
                        className="font-bold gap-2 px-6"
                        onClick={() => handleRunCommand()}
                        disabled={createCommand.isPending || !cmd.trim()}
                      >
                        <Play className="w-3.5 h-3.5" /> {createCommand.isPending ? 'Enviando...' : 'Rodar'}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Comandos Pré-definidos</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => handleRunCommand('ipconfig /flushdns')}
                          disabled={createCommand.isPending}
                        >
                          <Network className="w-3.5 h-3.5" /> Flush DNS
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => handleRunCommand('netstat -an')}
                          disabled={createCommand.isPending}
                        >
                          <Activity className="w-3.5 h-3.5" /> Conexões Ativas
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => handleRunCommand('tasklist')}
                          disabled={createCommand.isPending}
                        >
                          <Cpu className="w-3.5 h-3.5" /> Ver Processos
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => handleRunCommand('gpupdate /force')}
                          disabled={createCommand.isPending}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Forçar GPO
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator className="border-border/20" />

                  <div className="bg-black/90 rounded-xl p-4 font-mono text-[11px] overflow-hidden flex flex-col min-h-[300px] border border-zinc-800 shadow-inner">
                    <div className="flex items-center gap-2 mb-3 border-b border-zinc-900 pb-2">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                      </div>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest ml-2">Console de Saída</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                      {commandsLoading ? (
                        <div className="flex items-center justify-center h-full text-zinc-700 animate-pulse">Sincronizando logs...</div>
                      ) : commands.length === 0 ? (
                        <p className="text-zinc-700 italic"># Aguardando entrada...</p>
                      ) : (
                        commands.map((c) => (
                          <div key={c.ID} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-green-500/50 pr-1">#</span>
                              <span className="text-zinc-300 font-bold">{c.Command}</span>
                              <span className={cn(
                                "ml-auto text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase",
                                c.Status === 'completed' ? 'border-green-500/20 text-green-500 bg-green-500/5' :
                                c.Status === 'failed' ? 'border-red-500/20 text-red-500 bg-red-500/5' :
                                'border-amber-500/20 text-amber-500 bg-amber-500/5 animate-pulse'
                              )}>
                                {c.Status}
                              </span>
                            </div>
                            {c.Output && (
                              <pre className="text-[10px] text-zinc-500 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/30 whitespace-pre-wrap leading-relaxed shadow-sm">
                                {c.Output}
                              </pre>
                            )}
                          </div>
                        ))
                      )}
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
