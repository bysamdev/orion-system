import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Monitor, Wifi, WifiOff, AlertTriangle, Search, Server } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  useMonitoringDashboard,
  useMonitoringGroups,
  useGroupMachines,
  hasDiskAlert,
} from '@/hooks/useMonitoring';
import type { MachineGroup, MachineWithMetric } from '@/hooks/useMonitoring';
import { MachineCard, MachineCardSkeleton } from '@/components/monitoring/MachineCard';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { useQueryClient } from '@tanstack/react-query';

type StatusFilter = 'all' | 'online' | 'offline' | 'alert';

// ── Sidebar de grupos ─────────────────────────────────────
function GroupItem({
  group,
  selected,
  onClick,
}: {
  group: MachineGroup;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-all',
        selected
          ? 'bg-primary text-primary-foreground font-medium'
          : 'hover:bg-muted text-foreground'
      )}
    >
      <div className="min-w-0">
        <p className="text-sm truncate">{group.name}</p>
        {group.client_contact && (
          <p className={cn('text-[11px] truncate', selected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {group.client_contact}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="flex items-center gap-0.5 text-xs">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          <span className={selected ? 'text-primary-foreground' : 'text-green-600'}>{group.online_machines}</span>
        </span>
        <span className={cn('text-xs', selected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          /{group.total_machines}
        </span>
      </div>
    </button>
  );
}

// ── Grid de máquinas ──────────────────────────────────────
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3">
        <Server className="h-12 w-12 opacity-20" />
        <p className="text-sm">Selecione um grupo na lateral para ver as máquinas</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <MachineCardSkeleton key={i} />)}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground gap-2">
        <Monitor className="h-10 w-10 opacity-20" />
        <p className="text-sm">Nenhuma máquina encontrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filtered.map((m) => (
        <MachineCard key={m.id} machine={m} onClick={() => onSelect(m)} />
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
const Monitoring: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<MachineWithMetric | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(true);

  // RBAC — same pattern as Reports.tsx
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'customer') {
    return <Navigate to="/" replace />;
  }

  if (role !== 'admin' && role !== 'developer' && role !== 'technician') {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          <TopBar />
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar o monitoramento.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { data: dashboard } = useMonitoringDashboard();
  const { data: groups, isLoading: groupsLoading } = useMonitoringGroups();

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
        <TopBar />

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitoramento de Máquinas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Acompanhe o status e métricas em tempo real
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status badges */}
            {dashboard && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/10">
                  <Wifi className="w-3 h-3" />
                  {dashboard.online} online
                </Badge>
                <Badge variant="outline" className="gap-1.5 text-red-600 border-red-500/30 bg-red-500/10">
                  <WifiOff className="w-3 h-3" />
                  {dashboard.offline} offline
                </Badge>
                {dashboard.active_alerts > 0 && (
                  <Badge variant="outline" className="gap-1.5 text-yellow-600 border-yellow-500/30 bg-yellow-500/10">
                    <AlertTriangle className="w-3 h-3" />
                    {dashboard.active_alerts} alertas
                  </Badge>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar hostname..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="alert">Com Alerta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Body ── */}
        <div className="flex gap-6 min-h-[500px]">
          {/* Left sidebar — groups */}
          <aside className="w-56 flex-shrink-0">
            <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors w-full">
                  {groupsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Grupos / Clientes
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-1 pr-1">
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
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
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

            <MachinesGrid
              groupId={selectedGroupId}
              statusFilter={statusFilter}
              search={search}
              onSelect={setSelectedMachine}
            />
          </div>
        </div>
      </main>

      {/* Drawer */}
      <MachineDrawer
        machine={selectedMachine}
        open={!!selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </div>
  );
};

export default Monitoring;
