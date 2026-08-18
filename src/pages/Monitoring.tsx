import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
  Search,
  Server,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Activity,
  Cpu,
  HardDrive,
  Layers,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  useMonitoringDashboard,
  useMonitoringGroups,
  useGroupMachines,
  useMachineDetail,
  hasDiskAlert,
  pct,
  formatBytes,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from '@/hooks/useMonitoring';
import type { MachineGroup, MachineWithMetric } from '@/hooks/useMonitoring';
import { useCompanies } from '@/hooks/useCompanies';
import { MachineCard, MachineCardSkeleton } from '@/components/monitoring/MachineCard';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { GrafanaTelemetryView } from '@/components/monitoring/GrafanaTelemetryView';
import { useQueryClient } from '@tanstack/react-query';
import { MonitoringOnboarding } from '@/components/monitoring/MonitoringOnboarding';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

type StatusFilter = 'all' | 'online' | 'offline' | 'alert';

export interface MonitoringProps {
  externalMachineId?: string | null;
  onClearExternalMachine?: () => void;
}

// ── Sidebar de grupos ─────────────────────────────────────
function GroupItem({
  group,
  selected,
  onClick,
  onEdit,
  onDelete,
  canManage,
}: {
  group: MachineGroup;
  selected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
}) {
  return (
    <div className="relative group/item flex items-center mb-2">
      <button
        onClick={onClick}
        className={cn(
          'flex-1 text-left px-3 py-3 rounded-xl flex items-center justify-between gap-3 transition-all transform hover:scale-[1.01] active:scale-95 group relative',
          selected
            ? 'bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20'
            : 'hover:bg-muted/80 text-foreground border border-transparent hover:border-border/50'
        )}
      >
        <div className="min-w-0 pr-6">
          <p className="text-sm truncate leading-tight font-bold">{group.name}</p>
          {group.client_contact && (
            <p className={cn('text-[10px] truncate mt-0.5 opacity-60')}>
              {group.client_contact}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-1 text-[10px] font-bold">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full animate-pulse",
              selected ? "bg-white" : "bg-green-500"
            )} />
            <span className={selected ? 'text-primary-foreground' : 'text-green-600'}>{group.online_machines}</span>
          </span>
          <span className={cn('text-[10px] font-medium opacity-40')}>
            /{group.total_machines}
          </span>
        </div>
      </button>
      
      {canManage && (
        <div className="absolute right-2 opacity-0 group-hover/item:opacity-100 flex gap-1 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-7 w-7 rounded-full", selected ? "hover:bg-white/20 text-white" : "hover:bg-primary/10 text-primary")}
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full text-red-500 hover:bg-red-500/10"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Componente de Métricas Globais (KPI Cards) ──────────────
function MetricSection({
  label,
  value,
  subtext,
  icon: Icon,
  colorClass,
  gradient,
  progress,
  progressClass,
  extraBadges,
}: {
  label: string;
  value: string | number;
  subtext?: React.ReactNode;
  icon: any;
  colorClass?: string;
  gradient?: string;
  progress?: number;
  progressClass?: string;
  extraBadges?: React.ReactNode;
}) {
  return (
    <Card className={cn(
      "flex-1 min-w-[220px] border border-border/40 shadow-sm overflow-hidden group transition-all duration-300 hover:-translate-y-1 relative",
      gradient ? gradient : "bg-card"
    )}>
      <CardContent className="p-5 flex flex-col justify-between h-full relative z-10 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70 mb-1 truncate">
              {label}
            </p>
            <h4 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors tracking-tight">
              {value}
            </h4>
          </div>
          <div className={cn(
            "p-3 rounded-2xl flex-shrink-0 shadow-lg text-white", 
            colorClass ? colorClass : "bg-primary"
          )}>
            <Icon className="w-5 h-5 transform group-hover:scale-110 transition-transform" />
          </div>
        </div>

        {/* Barra de progresso */}
        {progress != null && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-muted/60 dark:bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', progressClass || 'bg-primary')}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Subtexto e Badges */}
        {(subtext || extraBadges) && (
          <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap pt-0.5">
            {subtext && <div className="truncate">{subtext}</div>}
            {extraBadges && <div className="flex items-center gap-1.5">{extraBadges}</div>}
          </div>
        )}
      </CardContent>
      {/* Decorative background circle */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 dark:bg-black/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
    </Card>
  );
}

// ── Grid Principal de Máquinas ──────────────────────────
function MachinesGrid({
  groupId,
  statusFilter,
  search,
  onSelect,
}: {
  groupId: string | null;
  statusFilter: StatusFilter;
  search: string;
  onSelect: (m: MachineWithMetric, initialTab?: string) => void;
}) {
  const { data: machines, isLoading } = useGroupMachines(groupId);

  const filtered = useMemo(() => {
    if (!machines) return [];
    return (machines || []).filter((m) => {
      if (statusFilter === 'online' && m.status !== 'online') return false;
      if (statusFilter === 'offline' && m.status !== 'offline') return false;
      if (statusFilter === 'alert' && !hasDiskAlert(m)) return false;
      if (search && !m.hostname.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [machines, statusFilter, search]);

  if (!groupId) {
    return <MonitoringOnboarding />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <MachineCardSkeleton key={i} />)}
      </div>
    );
  }

  if (filtered.length === 0) {
    const isTotallyEmpty = machines && machines.length === 0;
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3 border-2 border-dashed rounded-2xl opacity-50">
          <div className="p-4 bg-muted rounded-full">
            <Monitor className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">
            {isTotallyEmpty 
              ? "Nenhum dispositivo neste grupo ainda. Instale o agente para começar a monitorar."
              : "Nenhuma máquina encontrada com os filtros ativos."}
          </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
      {filtered.map((m) => (
        <MachineCard key={m.id} machine={m} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── Página Principal de Monitoramento (NOC View) ──────────
const Monitoring: React.FC<MonitoringProps> = ({ externalMachineId, onClearExternalMachine }) => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<MachineWithMetric | null>(null);
  const [selectedDrawerTab, setSelectedDrawerTab] = useState<string>('overview');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(true);

  // Group Management State
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isNocDialogOpen, setIsNocDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MachineGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    client_contact: '',
    company_id: '',
  });

  const { data: dashboard } = useMonitoringDashboard();
  const { data: groups, isLoading: groupsLoading } = useMonitoringGroups();
  const { data: companies = [] } = useCompanies();
  const { data: groupMachines } = useGroupMachines(selectedGroupId);
  
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  // Fleet Global Metric Calculations
  const fleetStats = useMemo(() => {
    const list = groupMachines || [];
    const onlineMachines = list.filter((m) => m.status === 'online');
    const onlineCount = onlineMachines.length;

    let totalCpu = 0;
    let cpuCount = 0;
    let totalRamBytes = 0;
    let usedRamBytes = 0;
    let totalDiskBytes = 0;
    let usedDiskBytes = 0;

    for (const m of list) {
      if (m.disk_total) totalDiskBytes += m.disk_total;
      if (m.disk_used) usedDiskBytes += m.disk_used;
    }

    for (const m of onlineMachines) {
      if (m.cpu_usage != null) {
        totalCpu += m.cpu_usage;
        cpuCount++;
      }
      if (m.ram_total) totalRamBytes += m.ram_total;
      if (m.ram_used) usedRamBytes += m.ram_used;
    }

    const avgCpu = cpuCount > 0 ? Math.round(totalCpu / cpuCount) : 0;
    const avgRamPct = totalRamBytes > 0 ? Math.round((usedRamBytes / totalRamBytes) * 100) : 0;

    return {
      avgCpu,
      avgRamPct,
      totalRamBytes,
      usedRamBytes,
      totalDiskBytes,
      usedDiskBytes,
      onlineCount,
      totalMachines: list.length,
    };
  }, [groupMachines]);

  const isAdminOrGestor = role === 'admin' || role === 'developer';

  const { data: externalMachineDetail } = useMachineDetail(externalMachineId || null);

  // Auto-select first group if none selected
  React.useEffect(() => {
    if (!selectedGroupId && groups && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  // Handle external machine selection (e.g. clicked from alerts tab)
  React.useEffect(() => {
    if (externalMachineId && externalMachineDetail?.machine) {
      // Set the group so the sidebar shows it
      if (externalMachineDetail.machine.group_id) {
        setSelectedGroupId(externalMachineDetail.machine.group_id);
      }
      // Open the drawer
      setSelectedMachine(externalMachineDetail.machine);
    }
  }, [externalMachineId, externalMachineDetail]);

  const handleSelectMachine = (machine: MachineWithMetric, initialTab: string = 'overview') => {
    setSelectedMachine(machine);
    setSelectedDrawerTab(initialTab);
  };

  const handleCloseDrawer = () => {
    setSelectedMachine(null);
    setSelectedDrawerTab('overview');
    if (onClearExternalMachine) {
      onClearExternalMachine();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleOpenGroupDialog = (group?: MachineGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupFormData({
        name: group.name,
        description: group.description || '',
        client_contact: group.client_contact || '',
        company_id: group.company_id || '',
      });
    } else {
      setEditingGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        client_contact: '',
        company_id: '',
      });
    }
    setIsGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({ id: editingGroup.id, updates: groupFormData });
        toast.success("Grupo atualizado com sucesso");
      } else {
        await createGroup.mutateAsync(groupFormData);
        toast.success("Grupo criado com sucesso");
      }
      setIsGroupDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar grupo: " + err.message);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o grupo "${name}"?`)) return;
    try {
      await deleteGroup.mutateAsync(id);
      toast.success("Grupo removido");
      if (selectedGroupId === id) setSelectedGroupId(null);
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'customer') {
    return <Navigate to="/conhecimento" replace />;
  }

  if (role && !['admin', 'developer', 'technician'].includes(role)) {
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

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId);

  return (
    <div className="w-full h-full bg-background">
      <main className="p-6 max-w-[1600px] mx-auto w-full">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                autoComplete="off"
                placeholder="Buscar por hostname..."
                className="pl-10 w-full sm:w-[300px] rounded-xl bg-muted/30 border-border/40 focus:bg-background transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {dashboard && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/10">
                  <Wifi className="w-3 h-3" />
                  {dashboard.online} online
                </Badge>
                <Badge variant="outline" className="gap-1.5 text-red-600 border-red-500/30 bg-red-500/10">
                  <WifiOff className="w-3 h-3" />
                  <span>{dashboard.offline} offline</span>
                </Badge>
              </div>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsNocDialogOpen(true)}
              className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-98"
            >
              <Activity className="w-4 h-4 animate-pulse" />
              Painel NOC / Telemetria Geral
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2 rounded-xl transition-all"
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ── Summary Cards (Global / Fleet KPIs) ── */}
        {dashboard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Card 1: Total de Dispositivos */}
            <MetricSection 
              label="Total de Dispositivos" 
              value={dashboard.total} 
              icon={Server} 
              colorClass="bg-blue-600"
              gradient="bg-blue-50/40 dark:bg-blue-950/10"
              progress={pct(dashboard.online, dashboard.total)}
              progressClass="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              subtext={
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {pct(dashboard.online, dashboard.total)}% online
                  </span>
                  <span>·</span>
                  <span className="text-red-500 dark:text-red-400 font-bold">
                    {pct(dashboard.offline, dashboard.total)}% offline
                  </span>
                </div>
              }
            />

            {/* Card 2: CPU Média da Frota */}
            <MetricSection 
              label="CPU Média da Frota" 
              value={`${fleetStats.avgCpu}%`} 
              icon={Cpu} 
              colorClass={
                fleetStats.avgCpu > 85 ? "bg-red-600" :
                fleetStats.avgCpu >= 70 ? "bg-amber-600" : "bg-emerald-600"
              }
              gradient={
                fleetStats.avgCpu > 85 ? "bg-red-50/40 dark:bg-red-950/10" :
                fleetStats.avgCpu >= 70 ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-emerald-50/40 dark:bg-emerald-950/10"
              }
              progress={fleetStats.avgCpu}
              progressClass={
                fleetStats.avgCpu > 85 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                fleetStats.avgCpu >= 70 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              }
              subtext={
                <span>
                  {fleetStats.onlineCount} máquina{fleetStats.onlineCount !== 1 ? 's' : ''} online
                </span>
              }
            />

            {/* Card 3: RAM Média da Frota */}
            <MetricSection 
              label="RAM Média da Frota" 
              value={`${fleetStats.avgRamPct}%`} 
              icon={Layers} 
              colorClass="bg-indigo-600"
              gradient="bg-indigo-50/40 dark:bg-indigo-950/10"
              progress={fleetStats.avgRamPct}
              progressClass="bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
              subtext={
                <span>
                  {formatBytes(fleetStats.totalRamBytes)} RAM total online
                </span>
              }
            />

            {/* Card 4: Armazenamento Total Monitorado */}
            <MetricSection 
              label="Armazenamento Total" 
              value={formatBytes(fleetStats.totalDiskBytes)} 
              icon={HardDrive} 
              colorClass="bg-amber-600"
              gradient="bg-amber-50/40 dark:bg-amber-950/10"
              progress={pct(fleetStats.usedDiskBytes, fleetStats.totalDiskBytes)}
              progressClass="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
              subtext={
                <span>
                  {formatBytes(fleetStats.usedDiskBytes)} usado ({pct(fleetStats.usedDiskBytes, fleetStats.totalDiskBytes)}%)
                </span>
              }
            />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left sidebar — groups */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="sticky top-8">
              <div className="mb-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 px-3">
                  Filtrar por Status
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 px-1">
                   <Button 
                    variant={statusFilter === 'all' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="justify-start gap-2"
                    onClick={() => setStatusFilter('all')}
                   >
                     Todos
                   </Button>
                   <Button 
                    variant={statusFilter === 'online' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="justify-start gap-2 text-green-600"
                    onClick={() => setStatusFilter('online')}
                   >
                     <Wifi className="w-3.5 h-3.5" /> Online
                   </Button>
                   <Button 
                    variant={statusFilter === 'offline' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="justify-start gap-2 text-red-600"
                    onClick={() => setStatusFilter('offline')}
                   >
                     <WifiOff className="w-3.5 h-3.5" /> Offline
                   </Button>
                   <Button 
                    variant={statusFilter === 'alert' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="justify-start gap-2 text-yellow-600"
                    onClick={() => setStatusFilter('alert')}
                   >
                     <AlertTriangle className="w-3.5 h-3.5" /> Com Alerta
                   </Button>
                </div>
              </div>

              <Separator className="my-6 opacity-50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between px-3 w-full">
                  <button 
                    className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    onClick={() => setGroupsOpen(!groupsOpen)}
                  >
                    {groupsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Grupos / Clientes
                  </button>
                  {isAdminOrGestor && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 rounded-full hover:bg-primary/10 text-primary"
                      onClick={() => handleOpenGroupDialog()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                
                {groupsOpen && (
                  <ScrollArea className="h-[calc(100vh-500px)]">
                    <div className="space-y-1 pr-3 pl-1">
                      {groupsLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))
                      ) : !groups || groups.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">
                          Nenhum grupo cadastrado
                        </p>
                      ) : (
                        (groups || []).map((g) => (
                          <GroupItem
                            key={g.id}
                            group={g}
                            selected={selectedGroupId === g.id}
                            onClick={() => setSelectedGroupId(g.id)}
                            canManage={isAdminOrGestor}
                            onEdit={() => handleOpenGroupDialog(g)}
                            onDelete={() => handleDeleteGroup(g.id, g.name)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </aside>

          {/* Main — machine grid */}
          <div className="flex-1 min-w-0">
            {selectedGroup && (
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-foreground">{selectedGroup.name}</h2>
                <Badge variant="secondary" className="text-xs">
                  {selectedGroup.total_machines} máquina{selectedGroup.total_machines !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}

            {groupsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <MachineCardSkeleton key={i} />)}
              </div>
            ) : (
              <MachinesGrid
                groupId={selectedGroupId}
                statusFilter={statusFilter}
                search={search}
                onSelect={handleSelectMachine}
              />
            )}
          </div>
        </div>
      </main>

      {/* Group Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingGroup ? 'Editar Grupo' : 'Novo Grupo / Cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome do Grupo</Label>
              <Input 
                id="name" 
                autoComplete="off"
                placeholder="Ex: Matriz - São Paulo" 
                value={groupFormData.name}
                onChange={e => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl border-border/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contato / Responsável</Label>
              <Input 
                id="contact" 
                autoComplete="off"
                placeholder="Ex: João da Silva (joao@cliente.com)" 
                value={groupFormData.client_contact}
                onChange={e => setGroupFormData(prev => ({ ...prev, client_contact: e.target.value }))}
                className="rounded-xl border-border/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vincular à Empresa</Label>
              <Select 
                value={groupFormData.company_id || "none"} 
                onValueChange={v => setGroupFormData(prev => ({ ...prev, company_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="company" className="rounded-xl border-border/40">
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Global)</SelectItem>
                  {(companies || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea 
                id="desc" 
                placeholder="Breve descrição sobre o grupo..." 
                value={groupFormData.description}
                onChange={e => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-xl border-border/40 resize-none h-24"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
            <Button onClick={handleSaveGroup} disabled={!groupFormData.name || createGroup.isPending || updateGroup.isPending} className="rounded-xl font-bold">
              {editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOC Telemetry Modal */}
      <Dialog open={isNocDialogOpen} onOpenChange={setIsNocDialogOpen}>
        <DialogContent className="max-w-[96vw] w-[1450px] h-[92vh] p-0 flex flex-col rounded-2xl overflow-hidden border-border/40 bg-card shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Painel NOC — Telemetria Central</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Visão consolidada de telemetria de infraestrutura e nós via Grafana / Prometheus
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 p-4 bg-background overflow-hidden flex flex-col">
            <GrafanaTelemetryView
              isNocMode={true}
              height="100%"
              className="h-full border-none shadow-none"
              title="Painel Geral NOC — Todos os Clientes"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer */}
      <MachineDrawer
        machine={selectedMachine}
        open={!!selectedMachine}
        onClose={handleCloseDrawer}
        initialTab={selectedDrawerTab}
      />
    </div>
  );
};

const MonitoringWrapper: React.FC<MonitoringProps> = (props) => (
  <ErrorBoundary>
    <Monitoring {...props} />
  </ErrorBoundary>
);

export default MonitoringWrapper;
