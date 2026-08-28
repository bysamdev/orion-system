import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Monitor,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Search,
  Plus,
  Edit2,
  Trash2,
  Lock,
  LayoutGrid,
  List,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Navigate } from 'react-router-dom';
import {
  useMonitoringDashboard,
  useMonitoringGroups,
  useGroupMachines,
  useAllMachines,
  useMachineDetail,
  hasDiskAlert,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from '@/hooks/useMonitoring';
import type { MachineGroup, MachineWithMetric } from '@/hooks/useMonitoring';
import { useRealtimeMachines } from '@/hooks/useRealtimeMachines';
import { useCompanies } from '@/hooks/useCompanies';
import { MachineCard, MachineCardSkeleton } from '@/components/monitoring/MachineCard';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { MonitoringOnboarding } from '@/components/monitoring/MonitoringOnboarding';
import { PendingMachinesBanner } from '@/components/monitoring/PendingMachinesBanner';
import { ForceUpdateButton } from '@/components/monitoring/ForceUpdateButton';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
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
  hideHeader?: boolean;
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
          'flex-1 text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors group relative',
          selected
            ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
            : 'hover:bg-muted/70 text-foreground border border-transparent'
        )}
      >
        <div className="min-w-0 pr-4">
          <p className="text-sm truncate leading-tight font-semibold">{group.name}</p>
          {group.client_contact && (
            <p className={cn('text-[10px] truncate mt-0.5 opacity-70')}>
              {group.client_contact}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-1 text-[11px] font-semibold">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              selected ? "bg-white" : "bg-emerald-500"
            )} />
            <span className={selected ? 'text-primary-foreground' : 'text-emerald-600 dark:text-emerald-400'}>{group.online_machines}</span>
          </span>
          <span className={cn('text-[10px] font-medium opacity-50')}>
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

// ── Divisor e Título de Seção de Grupo / Cliente ─────────
function GroupSectionHeader({
  title,
  contact,
  onlineCount,
  totalCount,
}: {
  title: string;
  contact?: string | null;
  onlineCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Barra vertical destacada ao lado do nome */}
      <div className="w-1.5 h-6 rounded-full bg-primary flex-shrink-0" />
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <h3 className="text-base font-bold text-foreground tracking-tight">
          {title}
        </h3>
        {contact && (
          <span className="text-xs text-muted-foreground hidden sm:inline-block truncate max-w-[200px]">
            • {contact}
          </span>
        )}
        <Badge variant="outline" className="text-[11px] font-semibold ml-1 gap-1.5 border-border/60 bg-muted/30">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", onlineCount > 0 ? "bg-emerald-500" : "bg-muted-foreground")} />
          <span>{onlineCount}/{totalCount} online</span>
        </Badge>
      </div>
      {/* Linha horizontal dividindo a seção */}
      <div className="flex-1 border-t border-border/40 ml-2" />
    </div>
  );
}

function formatCompactLastSeen(dateStr?: string | null): string {
  if (!dateStr) return 'Nunca';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Visto agora';
  
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Visto agora';
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Visto há ${diffMin}min`;
  
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Visto há ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Visto há ${diffDays}d`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Visto há ${diffMonths}m`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `Visto há ${diffYears}a`;
}

// ── Tabela Compacta de Máquinas (Visualização Densa) ─────
function MachinesTableView({
  machines,
  onSelect,
}: {
  machines: MachineWithMetric[];
  onSelect: (m: MachineWithMetric, initialTab?: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[120px] text-left font-bold text-xs">Status</TableHead>
              <TableHead className="min-w-[220px] text-left font-bold text-xs">Dispositivo / Hostname</TableHead>
              <TableHead className="min-w-[180px] text-left font-bold text-xs">IP & Usuário</TableHead>
              <TableHead className="w-[160px] text-center font-bold text-xs">Último Visto</TableHead>
              <TableHead className="w-[100px] text-right pr-4 font-bold text-xs">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((m) => {
              const isOnline =
                m.status === 'online' ||
                m.status === 'alerta' ||
                (m.last_seen ? Date.now() - new Date(m.last_seen).getTime() < 5 * 60 * 1000 : false);
              const alerting = m.status === 'alerta' || hasDiskAlert(m);

              return (
                <TableRow
                  key={m.id}
                  onClick={() => onSelect(m, 'overview')}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        alerting ? "bg-amber-500 animate-pulse" : isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )} />
                      <span className="text-xs font-semibold">
                        {alerting ? 'Alerta' : isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {m.hostname}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {m.os || 'Desconhecido'} {m.os_version ? `(${m.os_version})` : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-semibold text-foreground/90">
                        {m.ip_address || '—'}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {m.current_user || 'Sem usuário'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-muted/60 font-mono text-[11px] font-semibold text-muted-foreground">
                      {formatCompactLastSeen(m.last_seen)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs font-bold hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(m, 'overview');
                      }}
                    >
                      Ver detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Grid Principal de Máquinas ──────────────────────────
function MachinesGrid({
  groupId,
  groups,
  statusFilter,
  search,
  viewMode = 'grid',
  onSelect,
}: {
  groupId: string | null;
  groups?: MachineGroup[];
  statusFilter: StatusFilter;
  search: string;
  viewMode?: 'grid' | 'table';
  onSelect: (m: MachineWithMetric, initialTab?: string) => void;
}) {
  const isAllGroups = groupId === 'all' || !groupId;

  const { data: groupMachines, isLoading: groupLoading } = useGroupMachines(
    !isAllGroups ? groupId : null
  );
  const { data: allMachines, isLoading: allLoading } = useAllMachines();

  const machines = isAllGroups ? allMachines : groupMachines;
  const isLoading = isAllGroups ? allLoading : groupLoading;

  const filterMachine = (m: MachineWithMetric) => {
    const isOnline =
      m.status === 'online' ||
      m.status === 'alerta' ||
      (m.last_seen ? Date.now() - new Date(m.last_seen).getTime() < 5 * 60 * 1000 : false);

    if (statusFilter === 'online' && !isOnline) return false;
    if (statusFilter === 'offline' && isOnline) return false;
    if (statusFilter === 'alert' && m.status !== 'alerta' && !hasDiskAlert(m)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchHostname = m.hostname?.toLowerCase().includes(q);
      const matchIp = m.ip_address?.toLowerCase().includes(q);
      const matchMac = m.mac_address?.toLowerCase().includes(q);
      const matchUser = m.current_user?.toLowerCase().includes(q);
      const matchOs = (m.os?.toLowerCase().includes(q)) || (m.os_version?.toLowerCase().includes(q));
      if (!matchHostname && !matchIp && !matchMac && !matchUser && !matchOs) return false;
    }
    return true;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <MachineCardSkeleton key={i} />)}
      </div>
    );
  }

  // ── Visão de Todos os Grupos (Sectioned by Client with Divider Bar) ──
  if (isAllGroups) {
    const registeredGroups = groups || [];

    // Agrupa máquinas por group_id
    const machinesByGroup = new Map<string, MachineWithMetric[]>();
    const unassignedMachines: MachineWithMetric[] = [];

    (machines || []).forEach((m) => {
      if (m.group_id) {
        const list = machinesByGroup.get(m.group_id) || [];
        list.push(m);
        machinesByGroup.set(m.group_id, list);
      } else {
        unassignedMachines.push(m);
      }
    });

    const totalMatching = (machines || []).filter(filterMachine).length;

    if (registeredGroups.length === 0 && unassignedMachines.length === 0) {
      return <MonitoringOnboarding />;
    }

    if (totalMatching === 0 && search) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3 border-2 border-dashed rounded-lg opacity-60">
          <div className="p-4 bg-muted rounded-full">
            <Monitor className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">
            Nenhuma máquina encontrada para a busca "{search}".
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {registeredGroups.map((g) => {
          const groupRawMachines = machinesByGroup.get(g.id) || [];
          const groupFiltered = groupRawMachines.filter(filterMachine);

          // Se estiver pesquisando ou filtrando por status e não houver correspondência, oculta o grupo
          if (groupFiltered.length === 0 && (search || statusFilter !== 'all')) {
            return null;
          }

          const onlineCount = groupRawMachines.filter(m =>
            m.status === 'online' || m.status === 'alerta' ||
            (m.last_seen ? Date.now() - new Date(m.last_seen).getTime() < 5 * 60 * 1000 : false)
          ).length;

          return (
            <div key={g.id} className="space-y-4">
              <GroupSectionHeader
                title={g.name}
                contact={g.client_contact}
                onlineCount={onlineCount}
                totalCount={groupRawMachines.length || g.total_machines}
              />

              {groupFiltered.length > 0 ? (
                viewMode === 'table' ? (
                  <MachinesTableView machines={groupFiltered} onSelect={onSelect} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {groupFiltered.map((m) => (
                      <MachineCard key={m.id} machine={m} onSelect={onSelect} />
                    ))}
                  </div>
                )
              ) : (
                <div className="p-6 rounded-lg border border-dashed border-border/50 bg-muted/20 text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5 py-8">
                  <Monitor className="w-5 h-5 text-muted-foreground/40" />
                  <span>Nenhum dispositivo cadastrado neste grupo ainda.</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Dispositivos sem grupo vinculado */}
        {unassignedMachines.length > 0 && (() => {
          const filteredUnassigned = unassignedMachines.filter(filterMachine);
          if (filteredUnassigned.length === 0 && (search || statusFilter !== 'all')) return null;

          const onlineUnassigned = unassignedMachines.filter(m =>
            m.status === 'online' || m.status === 'alerta' ||
            (m.last_seen ? Date.now() - new Date(m.last_seen).getTime() < 5 * 60 * 1000 : false)
          ).length;

          return (
            <div className="space-y-4">
              <GroupSectionHeader
                title="Dispositivos Globais / Sem Grupo"
                onlineCount={onlineUnassigned}
                totalCount={unassignedMachines.length}
              />
              {viewMode === 'table' ? (
                <MachinesTableView machines={filteredUnassigned} onSelect={onSelect} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredUnassigned.map((m) => (
                    <MachineCard key={m.id} machine={m} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Visão de Grupo Único Selecionado ──
  const selectedGroup = groups?.find(g => g.id === groupId);
  const filtered = (machines || []).filter(filterMachine);

  if (filtered.length === 0) {
    const isTotallyEmpty = machines && machines.length === 0;
    return (
      <div className="space-y-4">
        {selectedGroup && (
          <GroupSectionHeader
            title={selectedGroup.name}
            contact={selectedGroup.client_contact}
            onlineCount={selectedGroup.online_machines}
            totalCount={selectedGroup.total_machines}
          />
        )}
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3 border-2 border-dashed rounded-lg opacity-60">
          <div className="p-4 bg-muted rounded-full">
            <Monitor className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">
            {isTotallyEmpty
              ? "Nenhum dispositivo neste grupo ainda. Instale o agente para começar a monitorar."
              : "Nenhuma máquina encontrada com os filtros ativos."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedGroup && (
        <GroupSectionHeader
          title={selectedGroup.name}
          contact={selectedGroup.client_contact}
          onlineCount={selectedGroup.online_machines}
          totalCount={selectedGroup.total_machines}
        />
      )}
      {viewMode === 'table' ? (
        <MachinesTableView machines={filtered} onSelect={onSelect} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MachineCard key={m.id} machine={m} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página Principal de Monitoramento (NOC View) ───────────
const Monitoring: React.FC<MonitoringProps> = ({ externalMachineId, onClearExternalMachine, hideHeader }) => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: userProfile } = useUserProfile();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>('all');
  const [selectedMachine, setSelectedMachine] = useState<MachineWithMetric | null>(null);
  const [selectedDrawerTab, setSelectedDrawerTab] = useState<string>('overview');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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

  // role 'developer' = escopo global (ver escopo.Global() no backend) —
  // esse perfil legitimamente vê máquinas de qualquer empresa, então o
  // canal Realtime fica sem filtro de company_id pra ele.
  useRealtimeMachines(role === 'developer' ? undefined : userProfile?.company_id ?? undefined);

  const { data: dashboard } = useMonitoringDashboard();
  const { data: groups, isLoading: groupsLoading } = useMonitoringGroups();
  const { data: companies = [] } = useCompanies();
  
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const isAdminOrGestor = role === 'admin' || role === 'developer';
  const canApproveMachines = isAdminOrGestor || role === 'technician';

  const { data: externalMachineDetail } = useMachineDetail(externalMachineId || null);

  const totalOnlineAll = useMemo(() => {
    if (dashboard?.online !== undefined) return dashboard.online;
    return (groups || []).reduce((acc, g) => acc + (g.online_machines || 0), 0);
  }, [dashboard, groups]);

  const totalMachinesAll = useMemo(() => {
    if (dashboard?.total !== undefined) return dashboard.total;
    return (groups || []).reduce((acc, g) => acc + (g.total_machines || 0), 0);
  }, [dashboard, groups]);

  const totalOfflineAll = useMemo(() => {
    return Math.max(0, totalMachinesAll - totalOnlineAll);
  }, [totalMachinesAll, totalOnlineAll]);

  const totalAlertAll = useMemo(() => {
    return (groups || []).reduce((acc, g) => acc + (g.alert_machines || 0), 0);
  }, [groups]);

  // Auto-select "all" if none selected
  React.useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroupId('all');
    }
  }, [selectedGroupId]);

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

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 800);
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
    <div className="w-full space-y-6">
      <div className="w-full">

        {/* ── Page Header / Action Bar ── */}
        {hideHeader ? (
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-border/40">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                autoComplete="off"
                placeholder="Buscar máquinas, IP, usuário ou SO..."
                className="pl-9 w-full sm:w-[320px] md:w-[350px] text-xs sm:text-sm rounded-xl bg-muted/30 border-border/40 focus:bg-background transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Alternador de Visualização Cards / Tabela */}
              <div className="flex items-center bg-muted/40 border border-border/50 rounded-xl p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Visualização em Cards"
                  onClick={() => setViewMode('grid')}
                  className={cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode === 'grid' ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground")}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Visualização em Tabela Densa"
                  onClick={() => setViewMode('table')}
                  className={cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode === 'table' ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground")}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabela</span>
                </Button>
              </div>

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

              {isAdminOrGestor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenGroupDialog()}
                  className="gap-2 rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary transition-all font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Novo Grupo
                </Button>
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
        ) : (
          <PageHeader
            icon={Activity}
            badge="SUPERVISÃO RMM"
            title="Monitoramento de Sistemas"
            description="Supervisão em tempo real de hosts, servidores e estações de trabalho."
            actions={
              <>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    autoComplete="off"
                    placeholder="Buscar máquinas, IP, usuário ou SO..."
                    className="pl-9 w-full sm:w-[320px] md:w-[350px] text-xs sm:text-sm rounded-xl bg-muted/30 border-border/40 focus:bg-background transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Alternador de Visualização Cards / Tabela */}
                <div className="flex items-center bg-muted/40 border border-border/50 rounded-xl p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Visualização em Cards"
                    onClick={() => setViewMode('grid')}
                    className={cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode === 'grid' ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground")}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cards</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Visualização em Tabela Densa"
                    onClick={() => setViewMode('table')}
                    className={cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode === 'table' ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground")}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tabela</span>
                  </Button>
                </div>

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

                {canApproveMachines && <ForceUpdateButton />}

                {isAdminOrGestor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenGroupDialog()}
                    className="gap-2 rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary transition-all font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Grupo
                  </Button>
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
              </>
            }
          />
        )}

        {canApproveMachines && <PendingMachinesBanner />}

        {/* ── Body ── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar — groups */}
          <aside className="w-full lg:w-60 xl:w-64 flex-shrink-0">
            <div className="sticky top-8">
              <div className="mb-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                  Filtrar por Status
                </h3>
                <div className="space-y-1 pr-3 pl-1">
                  {/* Todos */}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-1 group relative',
                      statusFilter === 'all'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'hover:bg-muted/70 text-foreground border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutGrid className={cn("w-4 h-4 shrink-0", statusFilter === 'all' ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span className="text-sm truncate leading-tight font-semibold">Todos</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold',
                      statusFilter === 'all' ? 'text-primary-foreground opacity-90' : 'text-muted-foreground'
                    )}>
                      {totalMachinesAll}
                    </span>
                  </button>

                  {/* Online */}
                  <button
                    onClick={() => setStatusFilter('online')}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-1 group relative',
                      statusFilter === 'online'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'hover:bg-muted/70 text-foreground border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wifi className={cn("w-4 h-4 shrink-0", statusFilter === 'online' ? "text-primary-foreground" : "text-emerald-500")} />
                      <span className="text-sm truncate leading-tight font-semibold">Online</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold',
                      statusFilter === 'online' ? 'text-primary-foreground opacity-90' : 'text-emerald-600 dark:text-emerald-400'
                    )}>
                      {totalOnlineAll}
                    </span>
                  </button>

                  {/* Offline */}
                  <button
                    onClick={() => setStatusFilter('offline')}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-1 group relative',
                      statusFilter === 'offline'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'hover:bg-muted/70 text-foreground border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <WifiOff className={cn("w-4 h-4 shrink-0", statusFilter === 'offline' ? "text-primary-foreground" : "text-red-500")} />
                      <span className="text-sm truncate leading-tight font-semibold">Offline</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold',
                      statusFilter === 'offline' ? 'text-primary-foreground opacity-90' : 'text-red-500'
                    )}>
                      {totalOfflineAll}
                    </span>
                  </button>

                  {/* Com Alerta */}
                  <button
                    onClick={() => setStatusFilter('alert')}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-1 group relative',
                      statusFilter === 'alert'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'hover:bg-muted/70 text-foreground border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className={cn("w-4 h-4 shrink-0", statusFilter === 'alert' ? "text-primary-foreground" : "text-amber-500")} />
                      <span className="text-sm truncate leading-tight font-semibold">Com Alerta</span>
                    </div>
                    {totalAlertAll > 0 && (
                      <span className={cn(
                        'text-xs font-semibold',
                        statusFilter === 'alert' ? 'text-primary-foreground opacity-90' : 'text-amber-500'
                      )}>
                        {totalAlertAll}
                      </span>
                    )}
                  </button>
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
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    <div className="space-y-1 pr-3 pl-1">
                      {/* Item "Todos os Clientes / Grupos" */}
                      <button
                        onClick={() => setSelectedGroupId('all')}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-2 group relative',
                          selectedGroupId === 'all'
                            ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                            : 'hover:bg-muted/70 text-foreground border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <LayoutGrid className={cn("w-4 h-4 shrink-0", selectedGroupId === 'all' ? "text-primary-foreground" : "text-muted-foreground")} />
                          <p className="text-sm truncate leading-tight font-semibold">Todos os Clientes</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="flex items-center gap-1 text-[11px] font-semibold">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              selectedGroupId === 'all' ? "bg-white" : "bg-emerald-500"
                            )} />
                            <span className={selectedGroupId === 'all' ? 'text-primary-foreground' : 'text-emerald-600 dark:text-emerald-400'}>
                              {totalOnlineAll}
                            </span>
                          </span>
                          <span className={cn('text-[10px] font-medium opacity-50')}>
                            /{totalMachinesAll}
                          </span>
                        </div>
                      </button>

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
            {groupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <MachineCardSkeleton key={i} />)}
              </div>
            ) : (
              <MachinesGrid
                groupId={selectedGroupId}
                groups={groups}
                statusFilter={statusFilter}
                search={search}
                viewMode={viewMode}
                onSelect={handleSelectMachine}
              />
            )}
          </div>
        </div>
      </div>

      {/* Group Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
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
