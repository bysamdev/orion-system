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
} from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  useMonitoringDashboard,
  useMonitoringGroups,
  useGroupMachines,
  useMachineDetail,
  hasDiskAlert,
  pct,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useManagementCompanies,
} from '@/hooks/useMonitoring';
import type { MachineGroup, MachineWithMetric } from '@/hooks/useMonitoring';
import { MachineCard, MachineCardSkeleton } from '@/components/monitoring/MachineCard';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { MonitoringOnboarding } from '@/components/monitoring/MonitoringOnboarding';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

// ── Components Internos Profissionais ─────────────────────
function MetricSection({ label, value, subtext, icon: Icon, colorClass, gradient }: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  colorClass?: string;
  gradient?: string;
}) {
  return (
    <Card className={cn(
      "flex-1 min-w-[200px] border-none shadow-xl overflow-hidden group transition-all duration-300 hover:-translate-y-1 relative",
      gradient ? gradient : "bg-card"
    )}>
      <CardContent className="p-5 flex items-center gap-4 relative z-10">
        <div className={cn(
          "p-3 rounded-2xl flex-shrink-0 shadow-lg text-white", 
          colorClass ? colorClass : "bg-primary"
        )}>
          <Icon className="w-6 h-6 transform group-hover:scale-110 transition-transform" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{value}</h4>
            {subtext && <span className="text-[10px] font-bold opacity-50 truncate">{subtext}</span>}
          </div>
        </div>
      </CardContent>
      {/* Decorative background circle */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 dark:bg-black/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
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
  onSelect: (m: MachineWithMetric) => void;
}) {
  const { data: machines, isLoading } = useGroupMachines(groupId);

  const filtered = useMemo(() => {
    if (!machines) return [];
    return machines.filter((m) => {
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
        <MachineCard key={m.id} machine={m} onClick={() => onSelect(m)} />
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(true);

  // Group Management State
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MachineGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    client_contact: '',
    company_id: '',
  });

  const { data: dashboard } = useMonitoringDashboard();
  const { data: groups, isLoading: groupsLoading } = useMonitoringGroups();
  const { data: companies = [] } = useManagementCompanies();
  
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const isAdminOrGestor = role === 'admin' || role === 'developer' || role === 'gestor';

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

  const handleCloseDrawer = () => {
    setSelectedMachine(null);
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
    return <Navigate to="/tutorial" replace />;
  }

  if (role && !['admin', 'developer', 'technician', 'gestor'].includes(role)) {
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

        {/* ── Summary Cards ── */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <MetricSection 
              label="Total de Dispositivos" 
              value={dashboard.total} 
              icon={Server} 
              colorClass="bg-blue-600"
              gradient="bg-blue-50/50 dark:bg-blue-950/10"
            />
            <MetricSection 
              label="Máquinas Online" 
              value={dashboard.online} 
              subtext={`${pct(dashboard.online, dashboard.total)}%`}
              icon={Wifi} 
              colorClass="bg-green-600"
              gradient="bg-green-50/50 dark:bg-green-950/10"
            />
            <MetricSection 
              label="Máquinas Offline" 
              value={dashboard.offline} 
              subtext={`${pct(dashboard.offline, dashboard.total)}%`}
              icon={WifiOff} 
              colorClass="bg-red-600"
              gradient="bg-red-50/50 dark:bg-red-950/10"
            />
            <MetricSection 
              label="Alertas Ativos" 
              value={dashboard.active_alerts} 
              icon={AlertTriangle} 
              colorClass="bg-yellow-600"
              gradient="bg-yellow-50/50 dark:bg-yellow-950/10"
              subtext="pendentes"
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
                        groups.map((g) => (
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
                onSelect={setSelectedMachine}
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
                  {companies.map(c => (
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

      {/* Drawer */}
      <MachineDrawer
        machine={selectedMachine}
        open={!!selectedMachine}
        onClose={handleCloseDrawer}
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
