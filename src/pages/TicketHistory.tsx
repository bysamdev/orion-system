import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Search, History, Filter, X, ArrowRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TicketHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Fetch historic tickets
  const { data: historicTickets = [], isLoading } = useQuery({
    queryKey: ['historic-tickets'],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('tickets')
        .select('*')
        .in('status', ['resolved', 'closed', 'cancelled'])
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabaseRead
        .from('profiles')
        .select('id, company_id')
        .in('id', userIds);

      const companyIds = [...new Set(profiles?.map(p => p.company_id) || [])];
      const { data: companies } = await supabaseRead
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const companyMap = new Map(companies?.map(c => [c.id, c]) || []);

      return data.map((ticket: any) => {
        const profile = profileMap.get(ticket.user_id);
        const company = profile ? companyMap.get(profile.company_id) : null;
        return { ...ticket, company_name: company?.name || null };
      });
    }
  });

  const filteredTickets = useMemo(() => {
    let result = [...historicTickets];

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.ticket_number.toString().includes(q) || 
        t.requester_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [historicTickets, searchTerm, statusFilter, priorityFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <TopBar />
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <History className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-foreground">Histórico de Chamados</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1 tracking-tight">
              Consulte chamados resolvidos, fechados ou cancelados.
            </p>
          </div>
        </div>

        <Card className="border-border/40 shadow-xl shadow-primary/5 rounded-3xl overflow-visible bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40 pb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-purple-500" />
                <Input
                  placeholder="Pesquisar histórico..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 bg-muted/20 border-border/40 hover:bg-muted/30 focus-visible:ring-purple-500/20 rounded-2xl transition-all"
                />
              </div>
              <div className="flex gap-2">
                {(statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm !== '') && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-12 rounded-2xl px-4 text-xs font-bold uppercase tracking-wider">
                    <X className="w-4 h-4 mr-2" /> Limpar
                  </Button>
                )}
                <Button 
                  variant={advancedOpen ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="h-12 rounded-2xl border-border/40 font-bold text-xs uppercase tracking-wider px-6 transition-colors shadow-sm"
                >
                  <Filter className="w-4 h-4 mr-2" /> Filtros Analíticos
                </Button>
              </div>
            </div>

            {advancedOpen && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 p-4 bg-muted/20 rounded-2xl border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 bg-background border-border/40 rounded-xl">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="resolved">Resolvidos</SelectItem>
                      <SelectItem value="closed">Fechados</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Prioridade</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-10 bg-background border-border/40 rounded-xl">
                      <SelectValue placeholder="Todas as Prioridades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Prioridades</SelectItem>
                      <SelectItem value="urgent" className="text-red-500 font-bold">Urgente</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-14 pl-6">Nº</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14">Ticket</TableHead>
                    <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-14">Prioridade</TableHead>
                    <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-14 text-center">Situação Final</TableHead>
                    <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-14">Modificado em</TableHead>
                    <TableHead className="w-[80px] h-14"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center text-muted-foreground text-sm font-medium">
                        Nenhum ticket histórico encontrado com estes filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map(t => (
                      <TableRow key={t.id} onClick={() => navigate(`/ticket/${t.id}`)} className="group cursor-pointer border-b border-border/40 hover:bg-muted/30 transition-all">
                        <TableCell className="pl-6 py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
                          #{t.ticket_number}
                        </TableCell>
                        <TableCell className="py-4">
                          <p className="text-sm font-bold text-foreground group-hover:text-purple-500 transition-colors">{t.title}</p>
                          <p className="text-[10px] font-medium text-muted-foreground">{t.requester_name} · {t.company_name || 'N/A'}</p>
                        </TableCell>
                        <TableCell className="py-4">
                          <PriorityBadge priority={t.priority} size="sm" />
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {format(new Date(t.updated_at), "dd MMM yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-purple-500 transition-colors inline-block" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
            
            {!isLoading && filteredTickets.length > 0 && (
              <div className="p-4 border-t border-border/40 bg-muted/10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                Mostrando {filteredTickets.length} resultados limitados
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
