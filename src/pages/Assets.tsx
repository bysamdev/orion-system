import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Laptop, Smartphone, Server as ServerIcon, 
  Key, Filter, MoreHorizontal, Loader2, ArrowRightLeft, 
  History, Calendar, ShieldCheck, AlertCircle, Archive
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
}

const typeIcons: Record<string, any> = {
  'Hardware': Laptop,
  'Software': ShieldCheck,
  'License': Key,
  'Network': ServerIcon,
  'Mobile': Smartphone
};

const Assets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: assets, isLoading } = useQuery({
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

  const filteredAssets = assets?.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                         a.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
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
          
          <Button className="h-12 px-6 rounded-xl font-bold gap-2 shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
            <Plus className="w-5 h-5" /> Novo Ativo
          </Button>
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
                  placeholder="Pesquisar por nome ou serial..." 
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
                {filteredAssets?.map((asset) => {
                  const Icon = typeIcons[asset.type] || Laptop;
                  return (
                    <TableRow key={asset.id} className="group hover:bg-primary/5 transition-colors border-border/40">
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
                            {asset.warranty_until ? format(new Date(asset.warranty_until), "dd/MM/yyyy") : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAssets?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                        <Archive className="w-12 h-12" />
                        <div className="space-y-1">
                          <p className="text-lg font-black">Nenhum ativo encontrado</p>
                          <p className="text-sm">Tente mudar os filtros ou adicione um novo ativo.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Assets;
