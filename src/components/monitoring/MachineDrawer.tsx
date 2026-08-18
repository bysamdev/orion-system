import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  Cpu,
  HardDrive,
  Clock,
  Trash2,
  Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useMachineDetail,
  useMachineAlerts,
  useUpdateMachine,
  useDeleteMachine,
  useMonitoringGroups,
  pct,
  formatBytes,
  formatUptime,
} from '@/hooks/useMonitoring';
import type { MetricPeriod, MachineWithMetric } from '@/hooks/useMonitoring';
import { useCompanies } from '@/hooks/useCompanies';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { PerformanceChart } from './PerformanceChart';
import { InventoryTab } from './InventoryTab';
import { GrafanaTelemetryView } from './GrafanaTelemetryView';

const RemoteTerminal = React.lazy(() =>
  import('./RemoteTerminal').then((m) => ({ default: m.RemoteTerminal }))
);

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/30',
  high:     'bg-orange-500/10 text-orange-600 border-orange-500/30',
  medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low:      'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

interface MachineDrawerProps {
  machine: MachineWithMetric | null;
  open: boolean;
  onClose: () => void;
  initialTab?: string;
}

export const MachineDrawer: React.FC<MachineDrawerProps> = ({
  machine,
  open,
  onClose,
  initialTab = 'overview',
}) => {
  const machineId = machine?.id ?? null;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [period, setPeriod] = useState<MetricPeriod>('24h');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: detail, isLoading: detailLoading } = useMachineDetail(machineId);
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();
  const { data: companies = [] } = useCompanies();
  const { data: groups = [] } = useMonitoringGroups();
  const updateMachine = useUpdateMachine();
  const deleteMachine = useDeleteMachine();

  const canManage = role === 'admin' || role === 'developer';
  const isOnline = machine?.status === 'online';
  const ledColor = isOnline ? 'bg-green-400 shadow-green-400/60' : 'bg-red-400 shadow-red-400/60';

  // Synchronize activeTab when initialTab or machine changes
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, machine?.id, open]);

  // Sync selects when machine changes
  React.useEffect(() => {
    if (machine) {
      setSelectedGroupId(machine.group_id || '');
      setSelectedCompanyId(machine.company_id || '');
    }
  }, [machine]);

  const handleSaveChanges = async () => {
    if (!machineId) return;
    setIsSaving(true);
    try {
      await updateMachine.mutateAsync({
        id: machineId,
        updates: { group_id: selectedGroupId || '', company_id: selectedCompanyId || '' },
      });
      toast.success('Alterações salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!machineId) return;
    try {
      await deleteMachine.mutateAsync(machineId);
      toast.success(`Registro da máquina "${machine?.hostname}" excluído com sucesso!`);
      setIsDeleteDialogOpen(false);
      onClose();
    } catch (err: any) {
      toast.error('Erro ao excluir máquina: ' + err.message);
    }
  };

  // Metric calculations
  const cpuUsage = machine?.cpu_usage != null ? Math.round(machine.cpu_usage) : null;
  const ramUsagePct = pct(machine?.ram_used, machine?.ram_total);
  const diskUsagePct = pct(machine?.disk_used, machine?.disk_total);
  const cpuModel = detail?.hardware?.cpu_model;

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col border-l border-border/40 shadow-2xl">
          {/* Header */}
          <SheetHeader className="px-6 py-6 border-b border-border/40 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={cn('h-3.5 w-3.5 rounded-full shadow-lg', ledColor)} />
                  {isOnline && <div className={cn('absolute inset-0 rounded-full animate-ping opacity-30', ledColor)} />}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold tracking-tight">
                    {machine?.hostname ?? 'Máquina Desconhecida'}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-medium flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">{machine?.ip_address}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-muted-foreground">{machine?.os} {machine?.os_version}</span>
                  </SheetDescription>
                </div>
              </div>
              <Badge variant="outline" className={cn(
                'text-[10px] font-bold gap-1.5',
                isOnline ? 'text-green-600 border-green-500/30 bg-green-500/5' : 'text-red-500 border-red-500/30 bg-red-500/5',
              )}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 border-b border-border/40 bg-muted/5">
              <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
                {['overview', 'telemetry', 'inventory', 'actions'].map(tab => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider"
                  >
                    {{ overview: 'Resumo', telemetry: 'Telemetria', inventory: 'Inventário', actions: 'Terminal' }[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">

                {/* ── Overview tab ── */}
                <TabsContent value="overview" className="mt-0 space-y-8">
                  {/* KPI cards */}
                  <section className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'CPU',   value: cpuUsage != null ? `${cpuUsage}%` : '–' },
                        { label: 'RAM',   value: `${ramUsagePct}%` },
                        { label: 'Disco', value: `${diskUsagePct}%` },
                      ].map(({ label, value }) => (
                        <Card key={label} className="p-4 bg-muted/20 border-border/40">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">{label}</p>
                          <p className="text-2xl font-bold">{value}</p>
                        </Card>
                      ))}
                    </div>
                    <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
                      {[
                        { label: 'Visto pela última vez', value: machine?.last_seen ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR }) : '–' },
                        { label: 'Uptime do Sistema',     value: formatUptime(machine?.uptime) },
                        { label: 'Agente Orion',          value: `v${machine?.agent_version}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center py-2">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-semibold text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Performance chart */}
                  <PerformanceChart machineId={machineId} machine={machine} period={period} onPeriodChange={setPeriod} />

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
                        {alerts.map(alert => (
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

                  {/* Admin config */}
                  {canManage && (
                    <section className="space-y-4 pt-4">
                      <Separator className="border-border/20" />
                      <h3 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-1">Configurações Administrativas</h3>
                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 space-y-4">
                        {[
                          { label: 'Grupo / Cliente', value: selectedGroupId, onChange: setSelectedGroupId, options: groups },
                          { label: 'Empresa',         value: selectedCompanyId, onChange: setSelectedCompanyId, options: companies },
                        ].map(({ label, value, onChange, options }) => (
                          <div key={label} className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">{label}</label>
                            <Select value={value || 'none'} onValueChange={v => onChange(v === 'none' ? '' : v)}>
                              <SelectTrigger className="bg-background border-indigo-500/20 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {options.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        <Button className="w-full font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20" onClick={handleSaveChanges} disabled={isSaving}>
                          <RefreshCw className={cn('w-4 h-4', isSaving && 'animate-spin')} />
                          Salvar Alterações
                        </Button>

                        {/* Botão de Excluir Registro da Máquina */}
                        <div className="pt-3 border-t border-indigo-500/20">
                          <Button
                            variant="destructive"
                            className="w-full font-bold gap-2 bg-red-600/90 hover:bg-red-700 text-white shadow-md shadow-red-500/10"
                            onClick={() => setIsDeleteDialogOpen(true)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir Registro da Máquina
                          </Button>
                        </div>
                      </div>
                    </section>
                  )}
                </TabsContent>

                {/* ── Telemetry (Grafana & Realtime KPIs) tab ── */}
                <TabsContent value="telemetry" className="mt-0 space-y-5">
                  {/* Realtime KPI Cards Header */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Card 1: CPU */}
                    <Card className="p-3.5 bg-muted/20 border-border/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CPU em Tempo Real</span>
                        <Cpu className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-2xl font-black",
                            cpuUsage != null
                              ? cpuUsage > 85 ? "text-red-500" : cpuUsage > 70 ? "text-yellow-500" : "text-green-500"
                              : "text-muted-foreground"
                          )}>
                            {cpuUsage != null ? `${cpuUsage}%` : '–'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={cpuModel || 'CPU Host'}>
                          {cpuModel || (isOnline ? 'Processador Ativo' : 'Offline')}
                        </p>
                      </div>
                      <Progress
                        value={cpuUsage ?? 0}
                        className={cn(
                          "h-1.5 mt-2",
                          (cpuUsage ?? 0) > 85 ? "[&>div]:bg-red-500" : (cpuUsage ?? 0) > 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"
                        )}
                      />
                    </Card>

                    {/* Card 2: RAM */}
                    <Card className="p-3.5 bg-muted/20 border-border/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Memória RAM</span>
                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-2xl font-black",
                            ramUsagePct > 85 ? "text-red-500" : ramUsagePct > 70 ? "text-yellow-500" : "text-foreground"
                          )}>
                            {ramUsagePct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {formatBytes(machine?.ram_used)} / {formatBytes(machine?.ram_total)}
                        </p>
                      </div>
                      <Progress
                        value={ramUsagePct}
                        className={cn(
                          "h-1.5 mt-2",
                          ramUsagePct > 85 ? "[&>div]:bg-red-500" : ramUsagePct > 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-blue-500"
                        )}
                      />
                    </Card>

                    {/* Card 3: Storage */}
                    <Card className="p-3.5 bg-muted/20 border-border/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Armazenamento</span>
                        <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-2xl font-black",
                            diskUsagePct > 90 ? "text-red-500" : diskUsagePct > 75 ? "text-yellow-500" : "text-foreground"
                          )}>
                            {diskUsagePct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {formatBytes(machine?.disk_used)} / {formatBytes(machine?.disk_total)}
                        </p>
                      </div>
                      <Progress
                        value={diskUsagePct}
                        className={cn(
                          "h-1.5 mt-2",
                          diskUsagePct > 90 ? "[&>div]:bg-red-500" : diskUsagePct > 75 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-amber-500"
                        )}
                      />
                    </Card>

                    {/* Card 4: Uptime */}
                    <Card className="p-3.5 bg-muted/20 border-border/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Uptime do Sistema</span>
                        <Clock className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl sm:text-2xl font-black text-foreground">
                            {formatUptime(machine?.uptime)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {isOnline ? 'Em operação contínua' : 'Dispositivo offline'}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        <span className="text-[10px] font-semibold text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </Card>
                  </div>

                  {/* Grafana Host Telemetry Embed */}
                  <GrafanaTelemetryView
                    hostname={machine?.hostname}
                    machineId={machineId ?? undefined}
                    dashboardPath="/d/orion-agent-dashboard/orion-agent-visao-geral-do-host"
                    height="520px"
                    title={`Telemetria do Host: ${machine?.hostname ?? 'Máquina'}`}
                  />
                </TabsContent>

                {/* ── Inventory tab ── */}
                <TabsContent value="inventory" className="mt-0">
                  <InventoryTab machine={machine} hardware={detail?.hardware} />
                </TabsContent>

                {/* ── Terminal tab ── */}
                <TabsContent value="actions" className="mt-0">
                  <React.Suspense
                    fallback={
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs font-medium">Carregando console remoto...</span>
                      </div>
                    }
                  >
                    <RemoteTerminal
                      machineId={machineId}
                      hostname={machine?.hostname}
                      isOnline={isOnline}
                      userId={profile?.id}
                      userName={profile?.full_name ?? profile?.email}
                    />
                  </React.Suspense>
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Excluir Máquina Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão de Máquina
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro da máquina <strong>{machine?.hostname}</strong>?
              Esta ação removerá o dispositivo do monitoramento, incluindo seu histórico de métricas e inventário associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMachine}
              disabled={deleteMachine.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              {deleteMachine.isPending ? 'Excluindo...' : 'Sim, Excluir Registro'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
