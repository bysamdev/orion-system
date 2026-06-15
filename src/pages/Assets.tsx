import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Laptop, Smartphone, Server as ServerIcon, 
  Key, Filter, MoreHorizontal, Loader2, ArrowRightLeft, 
  History, Calendar, ShieldCheck, AlertCircle, Archive,
  HardDrive, Globe, Activity, Pencil, Trash2
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

interface Asset {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  company_id: string;
  company_name?: string;
  purchased_at: string | null;
  warranty_until: string | null;
  os: string | null;
  internal_ip: string | null;
  last_check: string | null;
  hostname: string | null;
}

const typeIcons: Record<string, any> = {
  'Hardware': Laptop,
  'Software': ShieldCheck,
  'License': Key,
  'Network': ServerIcon,
  'Mobile': Smartphone
};

const Assets = () => {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    company_id: '',
    type: 'Hardware',
    os: '',
    internal_ip: '',
    status: 'online',
    serial_number: '',
    brand: '',
    model: ''
  });

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          companies(name)
        `)
        .order('name');
      
      if (error) throw error;
      return data.map((a: any) => ({
        ...a,
        company_name: a.companies?.name
      })) as Asset[];
    }
  });

  const { data: assetTickets, isLoading: assetTicketsLoading } = useQuery({
    queryKey: ['asset-tickets', historyAsset?.id],
    queryFn: async () => {
      if (!historyAsset?.id) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('asset_id', historyAsset.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyAsset?.id
  });

  const createAsset = useMutation({
    mutationFn: async (newAsset: any) => {
      const { data, error } = await supabase.from('assets').insert([newAsset]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Sucesso', description: 'Ativo cadastrado com sucesso.' });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Sucesso', description: 'Ativo atualizado com sucesso.' });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Removido', description: 'Ativo removido do sistema.' });
    }
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      hostname: '',
      company_id: '',
      type: 'Hardware',
      os: '',
      internal_ip: '',
      status: 'online',
      serial_number: '',
      brand: '',
      model: ''
    });
    setEditingAsset(null);
  }, []);

  const handleOpenEdit = useCallback((asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      hostname: asset.hostname || '',
      company_id: asset.company_id,
      type: asset.type,
      os: asset.os || '',
      internal_ip: asset.internal_ip || '',
      status: asset.status,
      serial_number: asset.serial_number || '',
      brand: asset.brand || '',
      model: asset.model || ''
    });
    setIsDialogOpen(true);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editingAsset) {
      updateAsset.mutate({ id: editingAsset.id, ...formData });
    } else {
      createAsset.mutate(formData);
    }
  }, [editingAsset, formData, updateAsset, createAsset]);

  const handleOpenHistory = useCallback((asset: Asset) => {
    setHistoryAsset(asset);
  }, []);

  const handleDeleteAsset = useCallback((id: string) => {
    if (confirm('Tem certeza que deseja remover este ativo?')) {
      deleteAsset.mutate(id);
    }
  }, [deleteAsset]);

  const filteredAssets = useMemo(() => {
    return assets?.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                           a.serial_number?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || a.type === typeFilter;
      return matchesSearch && matchesType;
    }) || [];
  }, [assets, search, typeFilter]);

  if (roleLoading || assetsLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 p-8 lg:p-12 max-w-[1400px] mx-auto w-full space-y-10 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>

          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-48" />
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-64 rounded-xl" />
                  <Skeleton className="h-10 w-40 rounded-xl" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="w-[300px] pl-8 text-[10px] font-black uppercase tracking-widest">Ativo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Empresa</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Garantia</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6, 7].map(i => (
                    <TableRow key={i} className="border-border/40">
                      <TableCell className="pl-8 py-4">
                        <Skeleton className="h-5 w-48 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Clientes não têm acesso direto ao CMDB completo por enquanto
  if (role === 'customer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      <main className="flex-1 p-8 lg:p-12 max-w-[1400px] mx-auto w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Laptop className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px]">CMDB</Badge>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Gestão de Ativos</h1>
            <p className="text-muted-foreground font-medium">Controle total sobre o inventário de hardware e software dos clientes.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6 rounded-xl font-bold gap-2 shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                <Plus className="w-5 h-5" /> Novo Ativo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAsset ? 'Editar Ativo' : 'Novo Ativo/Máquina'}</DialogTitle>
                <DialogDescription>
                  Preencha os dados técnicos da máquina ou ativo.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Amigável</Label>
                    <Input 
                      id="name" 
                      placeholder="Ex: Servidor-DB-01" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostname">Hostname/FQD</Label>
                    <Input 
                      id="hostname" 
                      placeholder="db01.cliente.local" 
                      value={formData.hostname}
                      onChange={e => setFormData({...formData, hostname: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Empresa (Cliente)</Label>
                    <Select 
                      value={formData.company_id} 
                      onValueChange={v => setFormData({...formData, company_id: v})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Ativo</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={v => setFormData({...formData, type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hardware">Hardware / Máquina</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="License">Licença</SelectItem>
                        <SelectItem value="Network">Rede</SelectItem>
                        <SelectItem value="Mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.type === 'Hardware' && (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                      <div className="space-y-2">
                        <Label htmlFor="os">Sistema Operacional</Label>
                        <Input 
                          id="os" 
                          placeholder="Windows Server 2022" 
                          value={formData.os}
                          onChange={e => setFormData({...formData, os: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="internal_ip">IP Interno</Label>
                        <Input 
                          id="internal_ip" 
                          placeholder="192.168.1.50" 
                          value={formData.internal_ip}
                          onChange={e => setFormData({...formData, internal_ip: e.target.value})}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serial">Série / Tag</Label>
                    <Input 
                      id="serial" 
                      value={formData.serial_number}
                      onChange={e => setFormData({...formData, serial_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input 
                      id="brand" 
                      value={formData.brand}
                      onChange={e => setFormData({...formData, brand: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input 
                      id="model" 
                      value={formData.model}
                      onChange={e => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createAsset.isPending || updateAsset.isPending}>
                    {(createAsset.isPending || updateAsset.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingAsset ? 'Salvar Alterações' : 'Cadastrar Ativo'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-muted/20 border-border/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Ativos</p>
                  <p className="text-3xl font-black">{assets?.length || 0}</p>
                </div>
                <div className="p-3 bg-background border border-border/50 rounded-2xl">
                  <Archive className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/20 border-border/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Em Manutenção</p>
                  <p className="text-3xl font-black text-warning">0</p>
                </div>
                <div className="p-3 bg-background border border-border/50 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/40 shadow-2xl shadow-primary/5 bg-card/50 backdrop-blur-md overflow-hidden">
          <CardHeader className="p-8 border-b border-border/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 max-w-md relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input 
                  autoComplete="off" placeholder="Pesquisar por nome ou serial..." 
                  className="pl-11 h-12 bg-background/50 border-border/40 rounded-xl focus-visible:ring-primary/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                {['all', 'Hardware', 'Software', 'License'].map((type) => (
                  <Button 
                    key={type}
                    variant={typeFilter === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "h-10 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider",
                      typeFilter === type ? "shadow-lg shadow-primary/20" : "bg-background/50 border-border/40"
                    )}
                  >
                    {type === 'all' ? 'Todos' : type}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="w-[300px] pl-8 text-[10px] font-black uppercase tracking-widest">Ativo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Empresa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Garantia</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets?.map((asset) => (
                  <AssetRow 
                    key={asset.id} 
                    asset={asset}
                    onOpenHistory={handleOpenHistory}
                    onOpenEdit={handleOpenEdit}
                    onDelete={handleDeleteAsset}
                  />
                ))}
                {filteredAssets?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-[400px] text-center">
                      <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="p-6 bg-primary/5 rounded-full ring-8 ring-primary/5">
                          <HardDrive className="w-16 h-16 text-primary opacity-40" />
                        </div>
                        <div className="space-y-2 max-w-sm mx-auto">
                          <h3 className="text-2xl font-black text-foreground">Nenhuma máquina cadastrada</h3>
                          <p className="text-muted-foreground font-medium">
                            Adicione a primeira máquina monitorada do seu cliente para gerenciar incidentes e inventário.
                          </p>
                        </div>
                        <Button 
                          onClick={() => setIsDialogOpen(true)}
                          className="h-12 px-8 rounded-xl font-bold gap-2 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Plus className="w-5 h-5" /> Adicionar Máquina
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog de Histórico */}
        <Dialog open={!!historyAsset} onOpenChange={(open) => !open && setHistoryAsset(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Histórico: {historyAsset?.name}</DialogTitle>
                  <DialogDescription>
                    Todos os chamados vinculados a este ativo.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-6">
              {assetTicketsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
                </div>
              ) : assetTickets && assetTickets.length > 0 ? (
                <div className="space-y-4">
                  {assetTickets.map((ticket: any) => (
                    <div 
                      key={ticket.id} 
                      className="group flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-all cursor-pointer"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    >
                      <div className={cn(
                        "mt-1 w-2 h-2 rounded-full",
                        ticket.status === 'open' ? "bg-blue-500" :
                        ticket.status === 'resolved' ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-foreground">#{ticket.ticket_number} — {ticket.title}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{formatDate(ticket.created_at, "dd/MM/yy HH:mm")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter px-1.5 h-4">{ticket.status}</Badge>
                          <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter px-1.5 h-4 opacity-70">{ticket.category}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 opacity-40">
                  <Activity className="w-12 h-12" />
                  <div className="space-y-1">
                    <p className="text-lg font-black">Nenhum chamado vinculado</p>
                    <p className="text-sm">Este ativo ainda não possui histórico de incidentes.</p>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="p-6 border-t border-border/40">
              <Button variant="outline" onClick={() => setHistoryAsset(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

const AssetRow = React.memo(({ 
  asset, 
  onOpenHistory, 
  onOpenEdit, 
  onDelete 
}: { 
  asset: Asset; 
  onOpenHistory: (asset: Asset) => void;
  onOpenEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}) => {
  const Icon = typeIcons[asset.type] || Laptop;
  return (
    <TableRow className="group hover:bg-primary/5 transition-colors border-border/40">
      <TableCell className="pl-8 py-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-background border border-border/60 rounded-xl group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight">{asset.name}</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">SN: {asset.serial_number || 'N/A'}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm font-semibold">{asset.company_name}</span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-border/40 font-bold text-[10px] rounded-md">{asset.type}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            asset.status === 'active' ? "bg-green-500" : "bg-warning"
          )} />
          <span className="text-xs font-bold capitalize">{asset.status}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col text-xs">
          <span className="font-medium text-muted-foreground">
            {formatDate(asset.warranty_until, "dd/MM/yyyy")}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right pr-8">
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => onOpenHistory(asset)}
            title="Histórico de Incidentes"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => onOpenEdit(asset)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={() => onDelete(asset.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
AssetRow.displayName = 'AssetRow';

export default Assets;
