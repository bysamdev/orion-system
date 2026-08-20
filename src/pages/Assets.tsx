import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStatusLabel } from '@/components/shared/StatusBadge';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { useCompanies } from '@/hooks/useCompanies';
import { useDeviceInventory, DeviceItem } from '@/hooks/useDeviceInventory';
import { useRealtimeMachines } from '@/hooks/useRealtimeMachines';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Laptop, Monitor, Server as ServerIcon, 
  Filter, MoreHorizontal, Loader2, History, Calendar, 
  AlertTriangle, HardDrive, Globe, Activity, Pencil, Trash2,
  Terminal, RefreshCw, User, Cpu, Network, CheckCircle2,
  XCircle, Clock, ShieldCheck, Ticket, X, ExternalLink, Building2,
  SlidersHorizontal
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { RemoteTerminal } from '@/components/monitoring/RemoteTerminal';
import { MachineDrawer } from '@/components/monitoring/MachineDrawer';
import { MachineWithMetric } from '@/hooks/useMonitoring';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetTopologyGraph } from '@/components/assets/AssetTopologyGraph';

const deviceIcons: Record<string, React.ElementType> = {
  'Computador': Monitor,
  'Notebook': Laptop,
  'Servidor': ServerIcon,
};

const Assets = () => {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();

  // Filters State
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawers State
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [terminalDevice, setTerminalDevice] = useState<DeviceItem | null>(null);
  const [historyDevice, setHistoryDevice] = useState<DeviceItem | null>(null);
  const [drawerMachine, setDrawerMachine] = useState<MachineWithMetric | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form State for Asset creation/edit
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    company_id: '',
    type: 'Computador',
    os: '',
    internal_ip: '',
    status: 'online',
    serial_number: '',
    brand: '',
    model: ''
  });

  const { data: companies } = useCompanies();

  useRealtimeMachines();

  // Load Device Inventory from unified hook
  const {
    data: devices = [],
    isLoading: devicesLoading,
    refetch: refetchInventory
  } = useDeviceInventory();

  // Query tickets history for selected device
  const { data: deviceTickets, isLoading: deviceTicketsLoading } = useQuery({
    queryKey: ['device-tickets', historyDevice?.id],
    queryFn: async () => {
      if (!historyDevice?.id) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`asset_id.eq.${historyDevice.id},description.ilike.%${historyDevice.hostname}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyDevice?.id
  });

  // Asset Mutations
  const createAsset = useMutation({
    mutationFn: async (newAsset: any) => {
      const { data, error } = await supabase.from('assets').insert([newAsset]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Dispositivo cadastrado com sucesso!');
      setIsAssetDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar dispositivo: ${err.message}`);
    }
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Dispositivo atualizado com sucesso!');
      setIsAssetDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar dispositivo: ${err.message}`);
    }
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Dispositivo removido do inventário.');
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover dispositivo: ${err.message}`);
    }
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      hostname: '',
      company_id: '',
      type: 'Computador',
      os: '',
      internal_ip: '',
      status: 'online',
      serial_number: '',
      brand: '',
      model: ''
    });
    setEditingAsset(null);
  }, []);

  const handleOpenEdit = useCallback((device: DeviceItem) => {
    if (!device.raw_asset) {
      toast.info('Este é um dispositivo monitorado automaticamente via agente Orion.');
      return;
    }
    setEditingAsset(device.raw_asset);
    setFormData({
      name: device.name || device.hostname,
      hostname: device.hostname,
      company_id: device.company_id,
      type: device.device_type,
      os: device.os || '',
      internal_ip: device.ip_address || '',
      status: device.status,
      serial_number: device.serial_number || '',
      brand: device.brand || '',
      model: device.model || ''
    });
    setIsAssetDialogOpen(true);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editingAsset) {
      updateAsset.mutate({ id: editingAsset.id, ...formData });
    } else {
      createAsset.mutate(formData);
    }
  }, [editingAsset, formData, updateAsset, createAsset]);

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    toast.info('Solicitando atualização de telemetria em tempo real...');
    await refetchInventory();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Inventário de dispositivos atualizado!');
    }, 800);
  }, [refetchInventory]);

  const handleDeleteAsset = useCallback((id: string) => {
    if (confirm('Tem certeza que deseja remover este dispositivo do inventário?')) {
      deleteAsset.mutate(id);
    }
  }, [deleteAsset]);

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    const list = Array.isArray(devices) ? devices : [];
    return list.filter(d => {
      const queryStr = search.toLowerCase();
      const hostname = d.hostname || (d as any).name || '';
      const localIp = d.local_ip || (d as any).ip_address || (d as any).internal_ip || '';
      const mac = d.mac_address || (d as any).mac || '';
      const serial = (d as any).serial_number || (d as any).serial || '';
      const user = d.logged_in_user || (d as any).logged_user || (d as any).current_user || '';
      const compName = d.company_name || '';

      const matchesSearch = 
        hostname.toLowerCase().includes(queryStr) ||
        localIp.toLowerCase().includes(queryStr) ||
        mac.toLowerCase().includes(queryStr) ||
        serial.toLowerCase().includes(queryStr) ||
        user.toLowerCase().includes(queryStr) ||
        compName.toLowerCase().includes(queryStr);

      const matchesCompany = companyFilter === 'all' || d.company_id === companyFilter;
      const matchesType = typeFilter === 'all' || d.device_type === typeFilter || (d as any).type === typeFilter;
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;

      return matchesSearch && matchesCompany && matchesType && matchesStatus;
    });
  }, [devices, search, companyFilter, typeFilter, statusFilter]);

  // Resumo calculado sobre a lista JÁ FILTRADA, para os cards acompanharem o
  // filtro de cliente/tipo/status em vez de exibirem sempre o parque inteiro.
  //
  // A comparação de tipo aceita as duas grafias: useDeviceInventory grava
  // 'Computador'/'Notebook'/'Servidor', e a versão anterior testava só
  // 'desktop'/'notebook'/'server' — nenhuma casava, então os três cards ficavam
  // travados em zero.
  const summaryStats = useMemo(() => {
    const list = Array.isArray(filteredDevices) ? filteredDevices : [];
    const ehTipo = (d: DeviceItem, ...nomes: string[]) => {
      const t = (d.device_type || '').toLowerCase();
      return nomes.some((n) => t === n.toLowerCase());
    };
    return {
      totalDevices: list.length,
      desktopsCount: list.filter((d) => ehTipo(d, 'Computador', 'desktop')).length,
      notebooksCount: list.filter((d) => ehTipo(d, 'Notebook', 'notebook')).length,
      serversCount: list.filter((d) => ehTipo(d, 'Servidor', 'server')).length,
      onlineCount: list.filter((d) => d.status === 'online').length,
      offlineCount: list.filter((d) => d.status === 'offline').length,
      alertCount: list.reduce((acc, d) => acc + (d.alerts_count || 0), 0),
    };
  }, [filteredDevices]);

  const hasActiveFilters = search !== '' || companyFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setCompanyFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  if (roleLoading || devicesLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-12 w-36 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (role === 'customer') {
    return <Navigate to="/" replace />;
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Laptop className="w-5 h-5 text-primary" />
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold uppercase tracking-widest text-[10px]">
                  INVENTÁRIO COMPLETO
                </Badge>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                Inventário de Dispositivos
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Visão unificada de computadores, notebooks e servidores com estatísticas em tempo real.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleForceRefresh}
                disabled={isRefreshing}
                className="h-11 px-4 rounded-xl border-border/50 bg-background/50 hover:bg-accent font-semibold transition-all"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2 text-primary", isRefreshing && "animate-spin")} />
                Atualizar Telemetria
              </Button>

              <Dialog open={isAssetDialogOpen} onOpenChange={(open) => {
                setIsAssetDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <ButtonPrimary className="h-11 px-5 rounded-xl font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95" icon={<Plus className="w-4 h-4" />}>
                    Novo Ativo
                  </ButtonPrimary>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingAsset ? 'Editar Ativo/Dispositivo' : 'Cadastrar Novo Ativo'}</DialogTitle>
                    <DialogDescription>
                      Preencha as informações técnicas do dispositivo para o inventário CMDB.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-5 py-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome do Dispositivo</Label>
                        <Input 
                          id="name" 
                          placeholder="Ex: PC-VENDAS-01" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hostname">Hostname (FQDN / Redes)</Label>
                        <Input 
                          id="hostname" 
                          placeholder="pc-vendas01.dominio.local" 
                          value={formData.hostname}
                          onChange={e => setFormData({...formData, hostname: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cliente / Empresa</Label>
                        <Select 
                          value={formData.company_id} 
                          onValueChange={v => setFormData({...formData, company_id: v})}
                          required
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecione a empresa" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies?.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Dispositivo</Label>
                        <Select 
                          value={formData.type} 
                          onValueChange={v => setFormData({...formData, type: v})}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Computador">Computador</SelectItem>
                            <SelectItem value="Notebook">Notebook</SelectItem>
                            <SelectItem value="Servidor">Servidor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-border/40">
                      <div className="space-y-2">
                        <Label htmlFor="os">Sistema Operacional</Label>
                        <Input 
                          id="os" 
                          placeholder="Windows 11 Pro / Ubuntu 22.04" 
                          value={formData.os}
                          onChange={e => setFormData({...formData, os: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="internal_ip">IP Interno (Local)</Label>
                        <Input 
                          id="internal_ip" 
                          placeholder="192.168.1.100" 
                          value={formData.internal_ip}
                          onChange={e => setFormData({...formData, internal_ip: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="serial">Nº de Série</Label>
                        <Input 
                          id="serial" 
                          placeholder="SN982741"
                          value={formData.serial_number}
                          onChange={e => setFormData({...formData, serial_number: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="brand">Marca</Label>
                        <Input 
                          id="brand" 
                          placeholder="Dell / HP"
                          value={formData.brand}
                          onChange={e => setFormData({...formData, brand: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="model">Modelo</Label>
                        <Input 
                          id="model" 
                          placeholder="Latitude 5420"
                          value={formData.model}
                          onChange={e => setFormData({...formData, model: e.target.value})}
                        />
                      </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-border/40">
                      <Button type="button" variant="outline" onClick={() => setIsAssetDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createAsset.isPending || updateAsset.isPending}>
                        {(createAsset.isPending || updateAsset.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingAsset ? 'Salvar Alterações' : 'Cadastrar Dispositivo'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filtros Globais (Aplicados tanto à lista quanto à topologia) */}
          <Card className="border-border/40 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden mb-6">
            <CardHeader className="p-5 border-b border-border/40 bg-muted/20">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                
                {/* Search input (Hostname, IP, Serial) */}
                <div className="flex-1 max-w-lg relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    autoComplete="off" 
                    placeholder="Pesquisar por Hostname, IP, MAC ou Nº de Série..." 
                    className="pl-10 h-11 bg-background/70 border-border/50 rounded-xl focus-visible:ring-primary/20 text-sm font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button 
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Filter by Cliente */}
                  <div className="w-full sm:w-48">
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                      <SelectTrigger className="h-11 bg-background/70 border-border/50 rounded-xl text-xs font-semibold">
                        <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Cliente (Empresa)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-semibold">Todos os Clientes</SelectItem>
                        {companies?.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Device Type */}
                  <div className="w-full sm:w-44">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-11 bg-background/70 border-border/50 rounded-xl text-xs font-semibold">
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Tipo de Dispositivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-semibold">Todos os Tipos</SelectItem>
                        <SelectItem value="Computador" className="text-xs">Computador</SelectItem>
                        <SelectItem value="Notebook" className="text-xs">Notebook</SelectItem>
                        <SelectItem value="Servidor" className="text-xs">Servidor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Status */}
                  <div className="w-full sm:w-40">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-11 bg-background/70 border-border/50 rounded-xl text-xs font-semibold">
                        <Activity className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-semibold">Todos os Status</SelectItem>
                        <SelectItem value="online" className="text-xs font-semibold text-emerald-600">Online</SelectItem>
                        <SelectItem value="offline" className="text-xs font-semibold text-rose-600">Offline</SelectItem>
                        <SelectItem value="alerta" className="text-xs font-semibold text-amber-600">Alerta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      onClick={clearFilters}
                      className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>

              </div>
            </CardHeader>
          </Card>

          {/* Resumo do inventário — fora das abas porque descreve o recorte
              filtrado, que vale igualmente para a lista e para a topologia.
              Grade uniforme: todos os cards com a mesma estrutura e altura, em
              vez de o quinto card usar um layout próprio e quebrar a linha. */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                rotulo: 'Total de Dispositivos',
                valor: summaryStats.totalDevices,
                icone: HardDrive,
                cor: 'text-primary',
                fundo: 'bg-primary/10',
                borda: 'hover:border-primary/40',
              },
              {
                rotulo: 'Computadores',
                valor: summaryStats.desktopsCount,
                icone: Monitor,
                cor: 'text-emerald-700 dark:text-emerald-400',
                fundo: 'bg-emerald-500/10',
                borda: 'hover:border-emerald-500/40',
              },
              {
                rotulo: 'Notebooks',
                valor: summaryStats.notebooksCount,
                icone: Laptop,
                cor: 'text-sky-700 dark:text-sky-400',
                fundo: 'bg-sky-500/10',
                borda: 'hover:border-sky-500/40',
              },
              {
                rotulo: 'Servidores',
                valor: summaryStats.serversCount,
                icone: ServerIcon,
                cor: 'text-indigo-700 dark:text-indigo-400',
                fundo: 'bg-indigo-500/10',
                borda: 'hover:border-indigo-500/40',
              },
              {
                rotulo: 'Alertas Abertos',
                valor: summaryStats.alertCount,
                icone: AlertTriangle,
                cor: 'text-amber-700 dark:text-amber-400',
                fundo: 'bg-amber-500/10',
                borda: 'hover:border-amber-500/40',
              },
            ].map((c) => (
              <Card
                key={c.rotulo}
                className={cn('h-full bg-card border-border/50 shadow-sm transition-colors', c.borda)}
              >
                <CardContent className="h-full p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                      {c.rotulo}
                    </p>
                    <p className={cn('text-3xl font-bold tabular-nums mt-1.5 leading-none', c.cor)}>
                      {c.valor}
                    </p>
                  </div>
                  <div className={cn('shrink-0 p-3 rounded-2xl', c.fundo, c.cor)}>
                    <c.icone className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Situação atual em faixa própria: são três medidas do mesmo eixo
              (disponibilidade), não KPIs independentes como os cards acima. */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Situação Atual
              </p>
              {[
                { rotulo: 'Online', valor: summaryStats.onlineCount, ponto: 'bg-emerald-500', cor: 'text-emerald-700 dark:text-emerald-400' },
                { rotulo: 'Offline', valor: summaryStats.offlineCount, ponto: 'bg-rose-500', cor: 'text-rose-700 dark:text-rose-400' },
                { rotulo: 'Em Alerta', valor: summaryStats.alertCount, ponto: 'bg-amber-500', cor: 'text-amber-700 dark:text-amber-400' },
              ].map((s) => (
                <span key={s.rotulo} className="flex items-center gap-2 text-sm">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.ponto)} />
                  <span className={cn('font-bold tabular-nums', s.cor)}>{s.valor}</span>
                  <span className="text-muted-foreground">{s.rotulo}</span>
                </span>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="lista" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="lista">Lista de Ativos</TabsTrigger>
              <TabsTrigger value="topologia">Topologia de Rede</TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="space-y-6 outline-none">

          {/* 3. Table Columns */}
          <Card className="border-border/40 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="w-[170px] text-center text-[10px] font-semibold uppercase tracking-wider">Status / Tipo</TableHead>
                    <TableHead className="w-[180px] text-center text-[10px] font-semibold uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Geral (Informações Técnicas)</TableHead>
                    <TableHead className="w-[120px] text-center text-[10px] font-semibold uppercase tracking-wider">Alertas</TableHead>
                    <TableHead className="w-[130px] text-center text-[10px] font-semibold uppercase tracking-wider">Chamados (Tkts)</TableHead>
                    <TableHead className="w-[170px] text-center text-[10px] font-semibold uppercase tracking-wider">Última Atualização</TableHead>
                    <TableHead className="w-[160px] text-center text-[10px] font-semibold uppercase tracking-wider">Ações Rápidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => {
                    const DeviceIcon = deviceIcons[device.device_type] || Monitor;
                    
                    return (
                      <TableRow key={device.id} className="group hover:bg-primary/5 transition-colors border-border/40">
                        
                        {/* 1. Status / Tipo (Grid Aligned) */}
                        <TableCell className="py-3.5 align-middle">
                          <div className="grid grid-cols-[40px_1fr] items-center gap-3 w-[150px] mx-auto">
                            <div className="relative w-10 h-10 bg-background border border-border/60 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs flex-shrink-0">
                              <DeviceIcon className="w-5 h-5 text-primary" />
                              {/* Online / Offline status dot */}
                              <span 
                                className={cn(
                                  "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
                                  device.status === 'online' && "bg-emerald-500 shadow-sm shadow-emerald-500/50",
                                  device.status === 'offline' && "bg-rose-500",
                                  device.status === 'alerta' && "bg-amber-500 animate-pulse"
                                )} 
                              />
                            </div>
                            <div className="flex flex-col items-start gap-1 min-w-0">
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-md border w-fit uppercase tracking-tight",
                                  device.device_type === 'Servidor' && "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
                                  device.device_type === 'Notebook' && "bg-sky-500/10 text-sky-600 border-sky-500/30",
                                  device.device_type === 'Computador' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                )}
                              >
                                {device.device_type}
                              </Badge>
                              <span className="text-[10px] font-medium text-muted-foreground capitalize pl-0.5">
                                {device.status === 'online' && <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>}
                                {device.status === 'offline' && <span className="text-rose-600 dark:text-rose-400 font-medium">Offline</span>}
                                {device.status === 'alerta' && <span className="text-amber-600 dark:text-amber-400 font-medium">Alerta</span>}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. Cliente */}
                        <TableCell className="py-3.5 text-center align-middle">
                          <div className="flex items-center justify-center gap-2 max-w-[170px] mx-auto">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/80 flex-shrink-0" />
                            <span className="text-xs font-semibold text-foreground truncate" title={device.company_name}>
                              {device.company_name}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. Geral (Hostname, IP local, MAC, Logged user, OS) */}
                        <TableCell className="py-3.5 align-middle">
                          <div className="flex flex-col space-y-1.5">
                            {/* Hostname link */}
                            <button
                              onClick={() => {
                                if (device.raw_machine) {
                                  setDrawerMachine(device.raw_machine);
                                } else {
                                  setTerminalDevice(device);
                                }
                              }}
                              className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5 w-fit group/btn"
                            >
                              <span>{device.hostname}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                            </button>

                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 text-[11px] text-muted-foreground font-medium">
                              {/* IP Local */}
                              <div className="flex items-center gap-1.5 min-w-0" title={`IP Local: ${device.ip_address || device.local_ip || '—'}`}>
                                <Globe className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                                <span className="font-mono truncate">{device.ip_address || device.local_ip || '—'}</span>
                              </div>

                              {/* MAC Address */}
                              <div className="flex items-center gap-1.5 min-w-0" title={`MAC Address: ${device.mac_address || '—'}`}>
                                <Network className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                                <span className="font-mono text-[10px] truncate">{device.mac_address || '—'}</span>
                              </div>

                              {/* Logged-in User */}
                              <div className="flex items-center gap-1.5 min-w-0" title={`Usuário Logado: ${device.logged_user || device.logged_in_user || '—'}`}>
                                <User className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                                <span className="truncate">{device.logged_user || device.logged_in_user || '—'}</span>
                              </div>

                              {/* Operating System */}
                              <div className="flex items-center gap-1.5 min-w-0" title={`Sistema Operacional: ${device.os || '—'}`}>
                                <Cpu className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                                <span className="truncate">{device.os || '—'}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. Alertas */}
                        <TableCell className="py-4 text-center align-middle">
                          <div className="flex justify-center">
                            {device.alerts_count > 0 ? (
                              <Badge
                                variant="destructive"
                                className="bg-rose-500/10 text-rose-600 border border-rose-500/30 font-semibold text-[11px] px-2.5 py-1 gap-1 whitespace-nowrap"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                {device.alerts_count} {device.alerts_count === 1 ? 'Alerta' : 'Alertas'}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-[11px] px-2 py-0.5 whitespace-nowrap"
                              >
                                0 Alertas
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* 5. Chamados (Tkts) */}
                        <TableCell className="py-4 text-center align-middle">
                          <div className="flex justify-center">
                            <button 
                              onClick={() => setHistoryDevice(device)}
                              className="inline-flex items-center justify-center gap-1 hover:scale-105 transition-transform"
                            >
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "font-semibold text-[11px] px-2.5 py-1 gap-1 cursor-pointer transition-colors border",
                                  device.tickets_count > 0 
                                    ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" 
                                    : "bg-muted/40 text-muted-foreground border-border/40"
                                )}
                              >
                                <Ticket className="w-3.5 h-3.5" />
                                {device.tickets_count} {device.tickets_count === 1 ? 'Tkt' : 'Tkts'}
                              </Badge>
                            </button>
                          </div>
                        </TableCell>

                        {/* 6. Última Atualização */}
                        <TableCell className="py-4 text-center align-middle">
                          <div className="flex flex-col items-center justify-center text-xs space-y-0.5">
                            <span className="font-semibold text-foreground flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {formatDate(device.last_seen, "dd/MM/yyyy HH:mm")}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              Sincronizado via Agente
                            </span>
                          </div>
                        </TableCell>

                        {/* 7. Ações Rápidas (Terminal, Force Refresh, Ticket History, Edit/Delete) */}
                        <TableCell className="py-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            
                            {/* Button Terminal */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg border-border/60 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 transition-colors"
                                  onClick={() => setTerminalDevice(device)}
                                >
                                  <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir Terminal Remoto</TooltipContent>
                            </Tooltip>

                            {/* Button Force Refresh */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                                  onClick={handleForceRefresh}
                                >
                                  <RefreshCw className={cn("w-4 h-4 text-primary", isRefreshing && "animate-spin")} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Forçar Atualização</TooltipContent>
                            </Tooltip>

                            {/* Button Ticket History */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg border-border/60 hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/40 transition-colors"
                                  onClick={() => setHistoryDevice(device)}
                                >
                                  <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Histórico de Chamados</TooltipContent>
                            </Tooltip>

                            {/* Edit / Delete actions */}
                            {device.raw_asset && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 rounded-lg hover:bg-accent transition-colors"
                                      onClick={() => handleOpenEdit(device)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar Dispositivo</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                                      onClick={() => handleDeleteAsset(device.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remover Dispositivo</TooltipContent>
                                </Tooltip>
                              </>
                            )}

                          </div>
                        </TableCell>

                      </TableRow>
                    );
                  })}

                  {filteredDevices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-96 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
                          <div className="p-5 bg-primary/5 rounded-full ring-8 ring-primary/5">
                            <HardDrive className="w-12 h-12 text-primary opacity-40" />
                          </div>
                          <div className="space-y-1 max-w-sm mx-auto">
                            <h3 className="text-xl font-bold text-foreground">Nenhum dispositivo encontrado</h3>
                            <p className="text-xs text-muted-foreground font-medium">
                              Tente ajustar os filtros de busca, cliente ou status, ou adicione um novo ativo.
                            </p>
                          </div>
                          {hasActiveFilters ? (
                            <Button variant="outline" onClick={clearFilters} className="rounded-xl font-bold text-xs">
                              Limpar Filtros
                            </Button>
                          ) : (
                            <ButtonPrimary 
                              onClick={() => setIsAssetDialogOpen(true)}
                              className="h-10 px-5 rounded-xl font-bold shadow-lg shadow-primary/20"
                              icon={<Plus className="w-4 h-4" />}
                            >
                              Adicionar Dispositivo
                            </ButtonPrimary>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="topologia" className="outline-none">
              {/* Os mesmos filtros globais da lista alimentam a topologia; o
                  nome do cliente viaja junto para o cabeçalho identificar o
                  recorte em vista. */}
              <AssetTopologyGraph
                devices={filteredDevices}
                isFiltered={companyFilter !== 'all'}
                companyName={
                  companyFilter === 'all'
                    ? undefined
                    : companies?.find((c) => c.id === companyFilter)?.name
                }
              />
            </TabsContent>
          </Tabs>

          {/* Modal RMM Terminal */}
          <Dialog open={!!terminalDevice} onOpenChange={(open) => !open && setTerminalDevice(null)}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-6 overflow-hidden bg-background border-border/50">
              <DialogHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                    <Terminal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      Terminal Remoto — {terminalDevice?.hostname}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Execução remota de comandos via agente Orion ({terminalDevice?.company_name}).
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4">
                <RemoteTerminal 
                  machineId={terminalDevice?.id ?? null}
                  hostname={terminalDevice?.hostname}
                  isOnline={terminalDevice?.status === 'online'}
                  userId={profile?.id}
                  userName={profile?.full_name ?? undefined}
                />
              </div>

              <DialogFooter className="border-t border-border/40 pt-4">
                <Button variant="outline" onClick={() => setTerminalDevice(null)}>Fechar Terminal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal Histórico de Chamados */}
          <Dialog open={!!historyDevice} onOpenChange={(open) => !open && setHistoryDevice(null)}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-500/10 rounded-xl">
                    <History className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      Chamados do Dispositivo: {historyDevice?.hostname}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Histórico completo de tickets vinculados a este ativo ({historyDevice?.company_name}).
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {deviceTicketsLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
                  </div>
                ) : deviceTickets && deviceTickets.length > 0 ? (
                  <div className="space-y-3">
                    {deviceTickets.map((ticket: any) => (
                      <div 
                        key={ticket.id} 
                        className="group flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer"
                        onClick={() => {
                          setHistoryDevice(null);
                          navigate(`/ticket/${ticket.id}`);
                        }}
                      >
                        <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5">
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-foreground truncate">
                              #{ticket.ticket_number || ticket.id.slice(0, 6)} — {ticket.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatDate(ticket.created_at, "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                              {getStatusLabel(ticket.status)}
                            </Badge>
                            {ticket.priority && (
                              <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                                {ticket.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-56 text-center space-y-3 opacity-50">
                    <Ticket className="w-12 h-12 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-base font-bold">Nenhum chamado aberto</p>
                      <p className="text-xs text-muted-foreground">Este dispositivo não possui histórico recente de incidentes.</p>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter className="p-4 border-t border-border/40">
                <Button variant="outline" onClick={() => setHistoryDevice(null)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Machine Details Sheet Drawer */}
          {drawerMachine && (
            <MachineDrawer 
              machine={drawerMachine}
              open={!!drawerMachine}
              onClose={() => setDrawerMachine(null)}
            />
          )}

        </main>
      </div>
    </TooltipProvider>
  );
};

export default Assets;
