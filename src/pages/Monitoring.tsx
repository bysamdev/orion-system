import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Monitor, Wifi, WifiOff, AlertTriangle, Search, Server } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  useMonitoringDashboard,
  useMonitoringGroups,
  useGroupMachines,
  hasDiskAlert,
  pct,
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

// ── Components Internos Profissionais ─────────────────────
function MetricSection({ label, value, subtext, icon: Icon, colorClass }: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  colorClass?: string;
}) {
  return (
    <Card className="flex-1 min-w-[200px] border-none shadow-none bg-muted/30">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-2.5 rounded-xl bg-background border flex-shrink-0", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <h4 className="text-xl font-bold text-foreground leading-none">{value}</h4>
            {subtext && <span className="text-[10px] text-muted-foreground truncate">{subtext}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground gap-4 border-2 border-dashed rounded-2xl opacity-50">
        <div className="p-4 bg-muted rounded-full">
          <Server className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium">Nenhum Grupo Selecionado</p>
          <p className="text-xs">Escolha um cliente ou grupo na lateral para gerenciar as máquinas.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <MachineCardSkeleton key={i} />)}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3 border-2 border-dashed rounded-2xl opacity-50">
          <div className="p-4 bg-muted rounded-full">
            <Monitor className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">Nenhuma máquina encontrada filtros ativos.</p>
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

        {/* ── Summary Cards ── */}
        {dashboard && (
          <div className="flex flex-wrap gap-4 mb-8">
            <MetricSection 
              label="Total de Dispositivos" 
              value={dashboard.total} 
              icon={Server} 
              colorClass="bg-blue-500/10 text-blue-500 border-blue-500/20"
            />
            <MetricSection 
              label="Máquinas Online" 
              value={dashboard.online} 
              subtext={`${pct(dashboard.online, dashboard.total)}% do total`}
              icon={Wifi} 
              colorClass="bg-green-500/10 text-green-500 border-green-500/20"
            />
            <MetricSection 
              label="Máquinas Offline" 
              value={dashboard.offline} 
              subtext={`${pct(dashboard.offline, dashboard.total)}% do total`}
              icon={WifiOff} 
              colorClass="bg-red-500/10 text-red-500 border-red-500/20"
            />
            <MetricSection 
              label="Alertas Ativos" 
              value={dashboard.active_alerts} 
              subtext="Problemas pendentes"
              icon={AlertTriangle} 
              colorClass="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
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

              <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 hover:text-foreground transition-colors w-full mb-4">
                    {groupsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Grupos / Clientes
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
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
