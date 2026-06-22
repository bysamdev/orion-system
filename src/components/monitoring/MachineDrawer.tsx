import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useMachineDetail, useMachineAlerts, useManagementCompanies,
  useUpdateMachine, useMonitoringGroups, pct,
} from '@/hooks/useMonitoring';
import type { MetricPeriod, MachineWithMetric } from '@/hooks/useMonitoring';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { PerformanceChart } from './PerformanceChart';
import { InventoryTab } from './InventoryTab';
import { RemoteTerminal } from './RemoteTerminal';

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
}

export const MachineDrawer: React.FC<MachineDrawerProps> = ({ machine, open, onClose }) => {
  const machineId = machine?.id ?? null;
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState<MetricPeriod>('24h');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: detail, isLoading: detailLoading } = useMachineDetail(machineId);
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();
  const { data: companies = [] } = useManagementCompanies();
  const { data: groups = [] } = useMonitoringGroups();
  const updateMachine = useUpdateMachine();

  const canManage = role === 'admin' || role === 'developer';
  const isOnline = machine?.status === 'online';
  const ledColor = isOnline ? 'bg-green-400 shadow-green-400/60' : 'bg-red-400 shadow-red-400/60';

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

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col border-l border-border/40 shadow-2xl">
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
              {['overview', 'inventory', 'actions'].map(tab => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider"
                >
                  {{ overview: 'Resumo', inventory: 'Inventário', actions: 'Terminal' }[tab]}
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
                      { label: 'CPU',   value: machine?.cpu_usage != null ? `${Math.round(machine.cpu_usage)}%` : '–' },
                      { label: 'RAM',   value: `${pct(machine?.ram_used ?? null, machine?.ram_total ?? null)}%` },
                      { label: 'Disco', value: `${pct(machine?.disk_used ?? null, machine?.disk_total ?? null)}%` },
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
                      { label: 'Uptime do Sistema',     value: machine?.uptime ? `${Math.floor(machine.uptime / 3600)}h ${Math.floor((machine.uptime % 3600) / 60)}m` : '–' },
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
                    </div>
                  </section>
                )}
              </TabsContent>

              {/* ── Inventory tab ── */}
              <TabsContent value="inventory" className="mt-0">
                <InventoryTab machine={machine} hardware={detail?.hardware} />
              </TabsContent>

              {/* ── Terminal tab ── */}
              <TabsContent value="actions" className="mt-0">
                <RemoteTerminal
                  machineId={machineId}
                  hostname={machine?.hostname}
                  isOnline={isOnline}
                  userId={profile?.id}
                  userName={profile?.full_name ?? profile?.email}
                />
              </TabsContent>

            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
