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
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  RotateCcw,
  Zap,
  Battery,
  Eye,
  Radio,
  Globe,
  Network,
  User,
  Hash,
  Activity,
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
import type {
  MetricPeriod,
  MachineWithMetric,
  SecurityInfo,
  RemoteSoftwareInfo,
  BatteryInfo,
  UpdateStatusInfo,
} from '@/hooks/useMonitoring';
import { useCompanies } from '@/hooks/useCompanies';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { PerformanceChart } from './PerformanceChart';
import { InventoryTab } from './InventoryTab';

const RemoteTerminal = React.lazy(() =>
  import('./RemoteTerminal').then((m) => ({ default: m.RemoteTerminal }))
);

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/30',
  high:     'bg-orange-500/10 text-orange-600 border-orange-500/30',
  medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low:      'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

// ─── Sub-components for Security & Endpoint Compliance ───

export function EndpointSecurityCard({
  securityInfo,
}: {
  securityInfo?: SecurityInfo;
}) {
  const avList = securityInfo?.antivirus ?? [];
  const hasAv = avList.length > 0;
  const isAvActive = hasAv ? avList.some((a) => a.active) : false;
  const isFirewallActive = securityInfo?.firewall_active;
  const isBitlockerActive = securityInfo?.bitlocker_active;

  // Se houver outro antivírus ativo (ex: Kaspersky), o Windows desativa o Defender automaticamente.
  // Nesse caso, o Defender inativo não é exibido como alerta para não poluir a interface.
  const hasOtherActiveAv = avList.some(
    (a) => a.active && !a.name.toLowerCase().includes('defender')
  );

  const displayAvList = hasOtherActiveAv
    ? avList.filter((a) => a.active || !a.name.toLowerCase().includes('defender'))
    : avList;

  const isCompliant =
    (securityInfo ? (hasAv && isAvActive) : true) &&
    isFirewallActive !== false &&
    isBitlockerActive !== false;

  return (
    <Card className="p-4 bg-muted/10 border-border/40 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'p-2 rounded-xl',
              isCompliant
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}
          >
            {isCompliant ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Segurança do Endpoint
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Antivírus, Firewall do Windows e Criptografia
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-bold',
            isCompliant
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
          )}
        >
          {isCompliant ? 'Protegido' : 'Atenção Necessária'}
        </Badge>
      </div>

      <div className="divide-y divide-border/20">
        {/* Antivírus */}
        <div className="py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Antivírus Detectado:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {displayAvList.length > 0 ? (
              displayAvList.map((av, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">{av.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-semibold gap-1',
                      av.active
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                        : 'text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 animate-pulse'
                    )}
                  >
                    {av.active ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                    )}
                    {av.active ? 'Proteção Ativa' : 'Proteção Desativada'}
                  </Badge>
                  {av.updated != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px]',
                        av.updated
                          ? 'text-muted-foreground border-border/30'
                          : 'text-amber-600 border-amber-500/30 bg-amber-500/5'
                      )}
                    >
                      {av.updated ? 'Atualizado' : 'Definições Desatualizadas'}
                    </Badge>
                  )}
                </div>
              ))
            ) : securityInfo ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 gap-1 animate-pulse"
              >
                <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                Nenhum Antivírus Detectado
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Não coletado</span>
            )}
          </div>
        </div>

        {/* Firewall */}
        <div className="py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Firewall do Windows:</span>
          </div>
          <div>
            {isFirewallActive == null ? (
              <span className="text-xs text-muted-foreground">Não coletado</span>
            ) : isFirewallActive ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                Firewall Ativo
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 gap-1 animate-pulse"
              >
                <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                Firewall Inativo
              </Badge>
            )}
          </div>
        </div>

        {/* BitLocker */}
        <div className="py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isBitlockerActive ? (
              <Lock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">Criptografia C: (BitLocker):</span>
          </div>
          <div>
            {isBitlockerActive == null ? (
              <span className="text-xs text-muted-foreground">Não coletado</span>
            ) : isBitlockerActive ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 gap-1"
              >
                <Lock className="w-2.5 h-2.5 text-emerald-500" />
                Criptografia Ativa
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1"
              >
                <Unlock className="w-2.5 h-2.5 text-amber-500" />
                Desprotegido
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RemoteSoftwareCard({
  remoteSoftware,
}: {
  remoteSoftware?: RemoteSoftwareInfo[];
}) {
  const list = remoteSoftware ?? [];

  const cleanVersion = (v?: string) => {
    if (!v) return null;
    const trimmed = v.trim();
    if (trimmed.startsWith('v') || trimmed.startsWith('V')) return trimmed;
    if (trimmed.startsWith('ad ')) return `v${trimmed.replace('ad ', '').trim()}`;
    return `v${trimmed}`;
  };

  return (
    <Card className="p-4 bg-muted/10 border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Softwares de Acesso Remoto Instalados
            </h4>
            <p className="text-[10px] text-muted-foreground">
              AnyDesk, TeamViewer, RustDesk, etc.
            </p>
          </div>
        </div>
        {list.length > 0 ? (
          <Badge
            variant="secondary"
            className="text-[10px] font-semibold font-mono"
          >
            {list.length} instalado{list.length > 1 ? 's' : ''}
          </Badge>
        ) : remoteSoftware !== undefined ? (
          <Badge
            variant="outline"
            className="text-[10px] font-medium text-muted-foreground"
          >
            Nenhum
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Não coletado</span>
        )}
      </div>

      {list.length > 0 ? (
        <div className="space-y-2 pt-1">
          {list.map((item, idx) => {
            const vFormatted = cleanVersion(item.version);
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-card/60 text-xs text-foreground transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{item.name}</span>
                  {vFormatted && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                      {vFormatted}
                    </Badge>
                  )}
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/5">
                    Instalado
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : remoteSoftware !== undefined ? (
        <div className="bg-muted/20 border border-border/30 rounded-xl p-3 flex items-center gap-2.5 text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium">
            Nenhuma ferramenta de acesso remoto instalada.
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground py-2 px-1">
          Aguardando sincronização do agente...
        </div>
      )}
    </Card>
  );
}

export function BatteryMobilityCard({
  batteryInfo,
}: {
  batteryInfo?: BatteryInfo;
}) {
  if (!batteryInfo?.has_battery && batteryInfo?.percentage == null) {
    return null;
  }

  const pctValue = batteryInfo.percentage ?? 0;
  const isPlugged = batteryInfo.is_plugged ?? false;
  const isLow = pctValue <= 20 && !isPlugged;

  return (
    <Card className="p-4 bg-muted/10 border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'p-2 rounded-xl',
              isPlugged
                ? 'bg-emerald-500/10 text-emerald-600'
                : isLow
                ? 'bg-red-500/10 text-red-600'
                : 'bg-blue-500/10 text-blue-600'
            )}
          >
            {isPlugged ? (
              <Zap className="w-4 h-4 text-emerald-500" />
            ) : (
              <Battery className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Bateria & Mobilidade
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {isPlugged ? 'Conectado à rede elétrica' : 'Operando na bateria'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xl font-black font-mono', isLow ? 'text-red-500' : 'text-foreground')}>
            {pctValue}%
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold gap-1',
              isPlugged
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                : isLow
                ? 'text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10 animate-pulse'
                : 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5'
            )}
          >
            {isPlugged ? (
              <Zap className="w-2.5 h-2.5 text-emerald-500" />
            ) : (
              <Battery className="w-2.5 h-2.5" />
            )}
            {isPlugged ? 'Carregando' : 'Na Bateria'}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress
          value={pctValue}
          className={cn(
            'h-2',
            isLow
              ? '[&>div]:bg-red-500'
              : pctValue < 50
              ? '[&>div]:bg-amber-500'
              : '[&>div]:bg-emerald-500'
          )}
        />
        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span>Fonte: {isPlugged ? 'Alimentação AC conectada' : 'Descarga ativa'}</span>
          {isLow && <span className="text-red-500 font-bold">Carga Crítica (&lt; 20%)</span>}
        </div>
      </div>
    </Card>
  );
}

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
  const [selectedDeviceType, setSelectedDeviceType] = useState('desktop');
  const [isApplyingDeviceType, setIsApplyingDeviceType] = useState(false);

  const { data: detail } = useMachineDetail(machineId);
  const { data: alerts = [], isLoading: alertsLoading } = useMachineAlerts(machineId);
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();
  const { data: companies = [] } = useCompanies();
  const { data: groups = [] } = useMonitoringGroups();
  const updateMachine = useUpdateMachine();
  const deleteMachine = useDeleteMachine();

  const canManage = role === 'admin' || role === 'developer';
  const isAlertState = machine?.status === 'alerta';
  const isOnline =
    machine?.status === 'online' ||
    isAlertState ||
    (machine?.last_seen ? new Date().getTime() - new Date(machine.last_seen).getTime() < 5 * 60 * 1000 : false);
  const ledColor = isOnline
    ? isAlertState
      ? 'bg-amber-400 shadow-amber-400/60'
      : 'bg-green-400 shadow-green-400/60'
    : 'bg-red-400 shadow-red-400/60';

  // Extract compliance & telemetry data safely from machine or detail
  const securityInfo = detail?.machine?.security_info ?? machine?.security_info ?? detail?.hardware?.security_info;
  const remoteSoftware = detail?.machine?.remote_software ?? machine?.remote_software ?? detail?.hardware?.remote_software;
  const batteryInfo = detail?.machine?.battery_info ?? machine?.battery_info ?? detail?.hardware?.battery_info;
  const updateStatus = detail?.machine?.update_status ?? machine?.update_status ?? detail?.hardware?.update_status;

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
      setSelectedDeviceType(detail?.machine?.device_type || machine.device_type || 'desktop');
    }
  }, [machine, detail?.machine?.device_type]);

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

  // Override manual de classificação de dispositivo (Fase 3 do plano de
  // escalabilidade) — deliberadamente separado de handleSaveChanges/
  // "Salvar Alterações": o backend trava device_type_locked=true assim que
  // o campo device_type aparece no corpo da requisição, então incluí-lo
  // sempre no salvamento genérico de grupo/empresa travaria a classificação
  // em toda edição administrativa, mesmo sem intenção de corrigi-la.
  const handleApplyDeviceType = async () => {
    if (!machineId) return;
    setIsApplyingDeviceType(true);
    try {
      await updateMachine.mutateAsync({ id: machineId, updates: { device_type: selectedDeviceType } });
      toast.success('Classificação do dispositivo atualizada e travada — o agente não vai mais sobrescrevê-la.');
    } catch (err: any) {
      toast.error('Erro ao atualizar classificação: ' + err.message);
    } finally {
      setIsApplyingDeviceType(false);
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

  const domainName = machine?.domain || detail?.machine?.domain || 'WORKGROUP';
  const currentUser = machine?.current_user || detail?.machine?.current_user || '–';
  const ipAddress = machine?.ip_address || detail?.machine?.ip_address || '–';
  const macAddress =
    machine?.mac_address ||
    detail?.machine?.mac_address ||
    (Array.isArray(detail?.hardware?.network_interfaces) && detail?.hardware?.network_interfaces[0]?.mac
      ? detail.hardware.network_interfaces[0].mac
      : null) ||
    '–';

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col border-l border-border/40 shadow-2xl">
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-border/40 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className={cn('h-3.5 w-3.5 rounded-full shadow-lg', ledColor)} />
                  {isOnline && <div className={cn('absolute inset-0 rounded-full animate-ping opacity-30', ledColor)} />}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold tracking-tight">
                    {machine?.hostname ?? 'Máquina Desconhecida'}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-medium flex items-center gap-2 mt-0.5">
                    <span className="text-foreground font-semibold">{machine?.os} {machine?.os_version}</span>
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOnline && machine?.uptime ? (
                  <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5 bg-muted/80 text-muted-foreground gap-1 flex items-center">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground/70" />
                    ⏱️ {formatUptime(machine.uptime)}
                  </Badge>
                ) : null}
                <Badge variant="outline" className={cn(
                  'text-[10px] font-bold gap-1.5',
                  isOnline
                    ? isAlertState
                      ? 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
                      : 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5'
                    : 'text-red-500 border-red-500/30 bg-red-500/5',
                )}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? (isAlertState ? 'Online (Alerta)' : 'Online') : 'Offline'}
                </Badge>
              </div>
            </div>

            {/* Header Identification Grid (Domínio AD, Usuário Ativo, IP Interno, MAC Address) */}
            <div className="bg-background/70 dark:bg-background/40 rounded-xl p-2.5 border border-border/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0" title={`Domínio AD / Grupo: ${domainName}`}>
                <Network className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-tight">Domínio AD</span>
                  <span className="font-semibold text-foreground truncate block text-[11px] leading-tight">
                    {domainName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0" title={`Usuário Ativo: ${currentUser}`}>
                <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-tight">Usuário Ativo</span>
                  <span className="font-semibold text-foreground truncate block text-[11px] leading-tight">
                    {currentUser}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0" title={`IP Interno: ${ipAddress}`}>
                <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-tight">IP Interno</span>
                  <span className="font-mono text-muted-foreground truncate block text-[11px] leading-tight">
                    {ipAddress}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0" title={`Endereço MAC: ${macAddress}`}>
                <Hash className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block leading-tight">MAC Address</span>
                  <span className="font-mono text-muted-foreground truncate block text-[10.5px] leading-tight">
                    {macAddress}
                  </span>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 border-b border-border/40 bg-muted/5">
              <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-6">
                {['overview', 'telemetry', 'security', 'inventory', 'actions'].map(tab => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-bold uppercase tracking-wider"
                  >
                    {{
                      overview: 'Resumo',
                      telemetry: 'Telemetria',
                      security: 'Segurança',
                      inventory: 'Inventário',
                      actions: 'Terminal',
                    }[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">

                {/* ── Overview tab ── */}
                <TabsContent value="overview" className="mt-0 space-y-6">
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
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Network className="w-3.5 h-3.5 text-sky-500" /> Domínio AD / Grupo
                        </span>
                        <span className="text-xs font-semibold text-foreground">{domainName}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-indigo-500" /> Usuário Ativo
                        </span>
                        <span className="text-xs font-semibold text-foreground">{currentUser}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-emerald-500" /> IP Interno
                        </span>
                        <span className="text-xs font-mono font-semibold text-foreground">{ipAddress}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-purple-500" /> MAC Address
                        </span>
                        <span className="text-xs font-mono font-semibold text-foreground">{macAddress}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Visto pela última vez
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {machine?.last_seen ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR }) : '–'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Uptime do Sistema
                        </span>
                        <span className="text-xs font-semibold text-foreground">{formatUptime(machine?.uptime)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" /> Agente Orion
                        </span>
                        <span className="text-xs font-mono font-semibold text-foreground">v{machine?.agent_version || '–'}</span>
                      </div>
                    </div>
                  </section>

                  {/* 4 Módulos: Endpoint Security, Remote Software & Battery */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        🛡️ Endpoint &amp; Conformidade
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-primary px-2"
                        onClick={() => setActiveTab('security')}
                      >
                        Ver Detalhes &rarr;
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <EndpointSecurityCard securityInfo={securityInfo} />
                      <RemoteSoftwareCard remoteSoftware={remoteSoftware} />
                      {batteryInfo?.has_battery && (
                        <BatteryMobilityCard batteryInfo={batteryInfo} />
                      )}
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

                        {/* Classificação de dispositivo (Fase 3): separada do resto —
                            aplicar aqui trava a classificação, o agente para de
                            sobrescrevê-la nos próximos heartbeats. */}
                        <div className="pt-3 border-t border-indigo-500/20 space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Classificação do Dispositivo</label>
                            {detail?.machine?.device_type_locked ? (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase">
                                <Lock className="w-3 h-3" /> Travada manualmente
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                                <Unlock className="w-3 h-3" /> Auto (agente)
                              </span>
                            )}
                          </div>
                          {detail?.machine?.device_type_reason && (
                            <p className="text-[10px] text-muted-foreground px-1 italic">
                              Motivo da última detecção: {detail.machine.device_type_reason}
                            </p>
                          )}
                          <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                            <SelectTrigger className="bg-background border-indigo-500/20 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="desktop">Computador (Desktop)</SelectItem>
                              <SelectItem value="notebook">Notebook</SelectItem>
                              <SelectItem value="server">Servidor</SelectItem>
                              <SelectItem value="unknown">Não identificado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            className="w-full font-bold gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                            onClick={handleApplyDeviceType}
                            disabled={isApplyingDeviceType}
                          >
                            <Lock className={cn('w-4 h-4', isApplyingDeviceType && 'animate-pulse')} />
                            Corrigir e Travar Classificação
                          </Button>
                        </div>

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

                {/* ── Telemetry (Native High-Performance Panel) tab ── */}
                <TabsContent value="telemetry" className="mt-0 space-y-6">
                  {/* Seção 1: Indicadores em Tempo Real */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <Activity className="w-4 h-4 text-primary" />
                        Indicadores em Tempo Real
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {isOnline ? '🟢 Live Telemetry Ativo' : '🔴 Dispositivo Offline'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* Card 1: CPU */}
                      <Card className="p-4 bg-muted/20 hover:bg-muted/30 transition-all border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-4 h-4 text-indigo-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              CPU / Processamento
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0",
                              cpuUsage != null
                                ? cpuUsage > 85
                                ? "text-red-600 border-red-500/30 bg-red-500/10"
                                : cpuUsage > 70
                                ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                                : "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                : "text-muted-foreground border-border/40"
                            )}
                          >
                            {cpuUsage != null
                              ? cpuUsage > 85
                                ? "Carga Crítica"
                                : cpuUsage > 70
                                ? "Carga Alta"
                                : "Carga Normal"
                              : "Sem Dados"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "text-3xl font-black font-mono tracking-tight",
                                cpuUsage != null
                                  ? cpuUsage > 85
                                    ? "text-red-500"
                                    : cpuUsage > 70
                                    ? "text-amber-500"
                                    : "text-emerald-500"
                                  : "text-muted-foreground"
                              )}
                            >
                              {cpuUsage != null ? `${cpuUsage}%` : '–'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {isOnline ? '🟢 Ao Vivo' : '⚪ Estático'}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground font-medium truncate mt-1" title={cpuModel || 'Processador do Host'}>
                            {cpuModel || (isOnline ? 'Processador Ativo' : 'Offline')}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-border/20">
                          <Progress
                            value={cpuUsage ?? 0}
                            className={cn(
                              "h-1.5",
                              (cpuUsage ?? 0) > 85
                                ? "[&>div]:bg-red-500"
                                : (cpuUsage ?? 0) > 70
                                ? "[&>div]:bg-amber-500"
                                : "[&>div]:bg-emerald-500"
                            )}
                          />
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span>Uso: <strong className="text-foreground">{cpuUsage ?? 0}%</strong></span>
                            <span>Status: <strong className="text-foreground">{isOnline ? (isAlertState ? 'Alerta Ativo' : 'Operação Estável') : 'Offline'}</strong></span>
                          </div>
                        </div>
                      </Card>

                      {/* Card 2: RAM */}
                      <Card className="p-4 bg-muted/20 hover:bg-muted/30 transition-all border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Memória RAM
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0",
                              ramUsagePct > 85
                                ? "text-red-600 border-red-500/30 bg-red-500/10"
                                : ramUsagePct > 70
                                ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                                : "text-blue-600 border-blue-500/30 bg-blue-500/10"
                            )}
                          >
                            {ramUsagePct > 85 ? "Crítico" : ramUsagePct > 70 ? "Elevado" : "Normal"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "text-3xl font-black font-mono tracking-tight",
                                ramUsagePct > 85
                                  ? "text-red-500"
                                  : ramUsagePct > 70
                                  ? "text-amber-500"
                                  : "text-foreground"
                              )}
                            >
                              {ramUsagePct}%
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatBytes(machine?.ram_used)}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground font-medium truncate mt-1">
                            {formatBytes(machine?.ram_used)} usado de {formatBytes(machine?.ram_total)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-border/20">
                          <Progress
                            value={ramUsagePct}
                            className={cn(
                              "h-1.5",
                              ramUsagePct > 85
                                ? "[&>div]:bg-red-500"
                                : ramUsagePct > 70
                                ? "[&>div]:bg-amber-500"
                                : "[&>div]:bg-emerald-500"
                            )}
                          />
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span>Livre: <strong className="text-foreground">{machine?.ram_total && machine?.ram_used != null ? formatBytes(Math.max(0, machine.ram_total - machine.ram_used)) : '–'}</strong></span>
                            <span>Total: <strong className="text-foreground">{formatBytes(machine?.ram_total)}</strong></span>
                          </div>
                        </div>
                      </Card>

                      {/* Card 3: Storage */}
                      <Card className="p-4 bg-muted/20 hover:bg-muted/30 transition-all border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5">
                            <HardDrive className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Armazenamento (C:)
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0",
                              diskUsagePct > 90
                                ? "text-red-600 border-red-500/30 bg-red-500/10"
                                : diskUsagePct > 75
                                ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                                : "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                            )}
                          >
                            {diskUsagePct > 90 ? "Alerta" : diskUsagePct > 75 ? "Moderado" : "Normal"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "text-3xl font-black font-mono tracking-tight",
                                diskUsagePct > 90
                                  ? "text-red-500"
                                  : diskUsagePct > 75
                                  ? "text-amber-500"
                                  : "text-foreground"
                              )}
                            >
                              {diskUsagePct}%
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatBytes(machine?.disk_used)}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground font-medium truncate mt-1">
                            {formatBytes(machine?.disk_used)} usado de {formatBytes(machine?.disk_total)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-border/20">
                          <Progress
                            value={diskUsagePct}
                            className={cn(
                              "h-1.5",
                              diskUsagePct > 90
                                ? "[&>div]:bg-red-500"
                                : diskUsagePct > 75
                                ? "[&>div]:bg-amber-500"
                                : "[&>div]:bg-emerald-500"
                            )}
                          />
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span>Disponível: <strong className="text-foreground">{machine?.disk_total && machine?.disk_used != null ? formatBytes(Math.max(0, machine.disk_total - machine.disk_used)) : '–'}</strong></span>
                            <span>Total: <strong className="text-foreground">{formatBytes(machine?.disk_total)}</strong></span>
                          </div>
                        </div>
                      </Card>

                      {/* Card 4: Uptime & Agent Connectivity */}
                      <Card className="p-4 bg-muted/20 hover:bg-muted/30 transition-all border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Uptime &amp; Conexão
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0 gap-1",
                              isOnline
                                ? isAlertState
                                  ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  : "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                : "text-red-500 border-red-500/30 bg-red-500/10"
                            )}
                          >
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isOnline
                                  ? isAlertState
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-emerald-500 animate-pulse"
                                  : "bg-red-500"
                              )}
                            />
                            {isOnline ? (isAlertState ? "Online (Alerta)" : "Online") : "Offline"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
                              {formatUptime(machine?.uptime)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              v{machine?.agent_version || '1.0.0'}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground font-medium truncate mt-1">
                            {isOnline
                              ? `Último sync: ${machine?.last_seen ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true, locale: ptBR }) : 'agora'}`
                              : 'Dispositivo offline'}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-border/20">
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span>IP: <strong className="text-foreground font-mono">{ipAddress}</strong></span>
                            <span>Host: <strong className="text-foreground">{machine?.hostname}</strong></span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </section>

                  {/* Seção 2: Gráfico de Performance Histórica Nativo */}
                  <section className="space-y-2">
                    <PerformanceChart
                      machineId={machineId}
                      machine={machine}
                      period={period}
                      onPeriodChange={setPeriod}
                      title="Performance Histórica do Host"
                    />
                  </section>

                  {/* Seção 3: Detalhamento de Hardware & Discos Particionados */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <HardDrive className="w-4 h-4 text-amber-500" />
                        Detalhamento de Hardware &amp; Discos Particionados
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        Volumes físicos e lógicos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.isArray(detail?.hardware?.disks) && detail.hardware.disks.length > 0 ? (
                        detail.hardware.disks.map((d: any, idx: number) => {
                          const mount = d.mountpoint || d.mount_point || d.path || d.name || `Volume #${idx + 1}`;
                          const fs = d.fs_type || d.fstype || d.file_system || 'NTFS';
                          const used = d.used ?? 0;
                          const total = d.total ?? d.size ?? 0;
                          const diskPct = pct(used, total);
                          return (
                            <Card key={idx} className="p-4 bg-muted/15 border-border/40 space-y-3 shadow-none hover:bg-muted/25 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <HardDrive className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-foreground block">{mount}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">{fs}</span>
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold font-mono",
                                    diskPct > 90
                                      ? "text-red-500 border-red-500/30 bg-red-500/10"
                                      : diskPct > 75
                                      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                      : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                                  )}
                                >
                                  {diskPct}% em uso
                                </Badge>
                              </div>

                              <div className="space-y-1.5">
                                <Progress
                                  value={diskPct}
                                  className={cn(
                                    "h-2",
                                    diskPct > 90
                                      ? "[&>div]:bg-red-500"
                                      : diskPct > 75
                                      ? "[&>div]:bg-amber-500"
                                      : "[&>div]:bg-primary"
                                  )}
                                />
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                  <span>Usado: <strong className="text-foreground">{formatBytes(used)}</strong></span>
                                  <span>Livre: <strong className="text-foreground">{formatBytes(Math.max(0, total - used))}</strong></span>
                                  <span>Total: <strong className="text-foreground">{formatBytes(total)}</strong></span>
                                </div>
                              </div>
                            </Card>
                          );
                        })
                      ) : (
                        <Card className="p-4 bg-muted/15 border-border/40 space-y-3 shadow-none sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <HardDrive className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-foreground block">Volume Principal do Sistema (C:)</span>
                                <span className="text-[10px] text-muted-foreground font-mono">NTFS / Partição Ativa</span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold font-mono",
                                diskUsagePct > 90
                                  ? "text-red-500 border-red-500/30 bg-red-500/10"
                                  : diskUsagePct > 75
                                  ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                  : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                              )}
                            >
                              {diskUsagePct}% em uso
                            </Badge>
                          </div>

                          <div className="space-y-1.5">
                            <Progress
                              value={diskUsagePct}
                              className={cn(
                                "h-2",
                                diskUsagePct > 90
                                  ? "[&>div]:bg-red-500"
                                  : diskUsagePct > 75
                                  ? "[&>div]:bg-amber-500"
                                  : "[&>div]:bg-primary"
                              )}
                            />
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                              <span>Usado: <strong className="text-foreground">{formatBytes(machine?.disk_used)}</strong></span>
                              <span>
                                Livre:{' '}
                                <strong className="text-foreground">
                                  {machine?.disk_total && machine?.disk_used != null
                                    ? formatBytes(Math.max(0, machine.disk_total - machine.disk_used))
                                    : '–'}
                                </strong>
                              </span>
                              <span>Total: <strong className="text-foreground">{formatBytes(machine?.disk_total)}</strong></span>
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  </section>

                  {/* Seção 4: Adaptadores de Rede & Conectividade */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <Network className="w-4 h-4 text-sky-500" />
                        Adaptadores de Rede &amp; Conectividade
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        Interfaces físicas e virtuais detectadas
                      </span>
                    </div>

                    <Card className="border-border/40 bg-card/60 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/30 border-b border-border/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            <tr>
                              <th className="px-4 py-2.5">Interface de Rede</th>
                              <th className="px-4 py-2.5">Endereço IP (IPv4 / IPv6)</th>
                              <th className="px-4 py-2.5">Endereço MAC</th>
                              <th className="px-4 py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {Array.isArray(detail?.hardware?.network_interfaces) &&
                            detail.hardware.network_interfaces.length > 0 ? (
                              detail.hardware.network_interfaces.map((iface: any, idx: number) => {
                                const name = iface.name || iface.interface_name || `Interface ${idx + 1}`;
                                const mac = iface.mac || iface.mac_address || '–';
                                const ips: string[] = Array.isArray(iface.ips)
                                  ? iface.ips
                                  : iface.ip
                                  ? [iface.ip]
                                  : iface.ip_address
                                  ? [iface.ip_address]
                                  : [];

                                return (
                                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                                      <Network className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                                      <span>{name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-wrap gap-1">
                                        {ips.length > 0 ? (
                                          ips.map((ip, i) => (
                                            <Badge key={i} variant="outline" className="font-mono text-[10px] bg-muted/40 text-foreground">
                                              {ip}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-muted-foreground text-[11px]">N/A</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                      {mac}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[9px] font-semibold",
                                          isOnline
                                            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                                            : "text-muted-foreground border-border/30"
                                        )}
                                      >
                                        {isOnline ? "Conectado" : "Offline"}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr className="hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                                  <Network className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                                  <span>Adaptador Principal do Host</span>
                                </td>
                                <td className="px-4 py-3">
                                  {ipAddress !== '–' ? (
                                    <Badge variant="outline" className="font-mono text-[10px] bg-muted/40 text-foreground">
                                      {ipAddress}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-[11px]">Não identificado</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                  {macAddress}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-semibold",
                                      isOnline
                                        ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                                        : "text-muted-foreground border-border/30"
                                    )}
                                  >
                                    {isOnline ? "Conectado" : "Offline"}
                                  </Badge>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </section>

                  {/* Seção 5: Bateria & Conformidade de Segurança */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Bateria &amp; Conformidade de Segurança
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        Integridade e postura do dispositivo
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Endpoint Security */}
                      <EndpointSecurityCard securityInfo={securityInfo} />

                      {/* Remote Software Card */}
                      <RemoteSoftwareCard remoteSoftware={remoteSoftware} />

                      {/* Battery Card (if present) */}
                      {batteryInfo?.has_battery && (
                        <BatteryMobilityCard batteryInfo={batteryInfo} />
                      )}
                    </div>
                  </section>
                </TabsContent>

                {/* ── Security & Compliance tab ── */}
                <TabsContent value="security" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Segurança &amp; Conformidade do Endpoint</h3>
                      <p className="text-xs text-muted-foreground">
                        Visão aprofundada dos módulos de proteção, antivírus, criptografia BitLocker e softwares de acesso remoto.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* 1. Endpoint Security */}
                      <EndpointSecurityCard securityInfo={securityInfo} />

                      {/* 2. Remote Access Software */}
                      <RemoteSoftwareCard remoteSoftware={remoteSoftware} />

                      {/* 3. Battery & Mobility */}
                      {batteryInfo?.has_battery && (
                        <BatteryMobilityCard batteryInfo={batteryInfo} />
                      )}
                    </div>
                  </div>
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

