import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Search, History, Filter, X, ArrowRight, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { useNavigate, Navigate } from 'react-router-dom'; // Added Navigate import
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { ptBR } from 'date-fns/locale';
import { formatDate } from '@/lib/utils';

// Define types for tickets to avoid 'unknown' property errors
interface Ticket {
  id: string;
  ticket_number: number;
  title: string;
  requester_name: string;
  company_id: string;
  user_id: string;
  status: 'resolved' | 'closed' | 'cancelled' | string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | string;
  updated_at: string;
  company_name?: string; // Added for the joined data
}

export default function TicketHistory() {
  const navigate = useNavigate();
  const handleRowClick = useCallback((id: string) => {
    navigate(`/ticket/${id}`);
  }, [navigate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handlePriorityFilterChange = (val: string) => {
    setPriorityFilter(val);
    setPage(0);
  };

  // Fetch historic tickets
  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['historic-tickets', profile?.company_id, role, page, statusFilter, priorityFilter, debouncedSearch],
    queryFn: async () => {
      let query = supabaseRead
        .from('tickets')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        query = query.in('status', ['resolved', 'closed', 'cancelled']);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      if (debouncedSearch) {
        const isNumeric = !isNaN(Number(debouncedSearch)) && debouncedSearch.trim() !== '';
        if (isNumeric) {
          query = query.or(`title.ilike.%${debouncedSearch}%,ticket_number.eq.${Number(debouncedSearch)},requester_name.ilike.%${debouncedSearch}%`);
        } else {
          query = query.or(`title.ilike.%${debouncedSearch}%,requester_name.ilike.%${debouncedSearch}%`);
        }
      }

      if (role === 'customer' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }) // Tie-breaker for stable pagination
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;

      if (error) throw error;
      
      interface ProfileItem {
        id: string;
        company_id: string;
      }
      interface CompanyItem {
        id: string;
        name: string;
      }

      const userIds = [...new Set((data || []).map(t => t.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabaseRead.from('profiles').select('id, company_id').in('id', userIds)
        : { data: [] };
      
      const profiles = (profilesData || []) as ProfileItem[];

      const companyIds = [...new Set(profiles.map(p => p.company_id))];
      const { data: companiesData } = companyIds.length > 0
        ? await supabaseRead.from('companies').select('id, name').in('id', companyIds)
        : { data: [] };
      
      const companies = (companiesData || []) as CompanyItem[];

      const profileMap = new Map<string, ProfileItem>(profiles.map(p => [p.id, p]));
      const companyMap = new Map<string, CompanyItem>(companies.map(c => [c.id, c]));

      const enrichedTickets = (data || []).map((ticket: any) => {
        const profile = profileMap.get(ticket.user_id);
        const company = profile ? companyMap.get(profile.company_id) : null;
        return { ...ticket, company_name: company?.name || null } as Ticket;
      });

      return { tickets: enrichedTickets, count: count || 0 };
    }
  });

  const filteredTickets = queryResult?.tickets || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setPage(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
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
                  autoComplete="off" placeholder="Pesquisar histórico..."
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
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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
                  <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
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
                      <TicketHistoryRow key={t.id} ticket={t} onClick={handleRowClick} />
                    ))
                  )}
                </TableBody>
              </Table>
            )}
            
            {!isLoading && filteredTickets.length > 0 && (
              <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-sm">
                <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Mostrando {filteredTickets.length} resultado{filteredTickets.length !== 1 ? 's' : ''}{totalCount > filteredTickets.length ? ' limitado' + (filteredTickets.length !== 1 ? 's' : '') : ''}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-bold text-muted-foreground px-2">
                      Página {page + 1} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

interface TicketHistoryRowProps {
  ticket: Ticket;
  onClick: (id: string) => void;
}

const TicketHistoryRow = React.memo(({ ticket, onClick }: TicketHistoryRowProps) => {
  return (
    <TableRow 
      onClick={() => onClick(ticket.id)} 
      className="group cursor-pointer border-b border-border/40 hover:bg-muted/30 transition-all"
    >
      <TableCell className="pl-6 py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
        #{ticket.ticket_number}
      </TableCell>
      <TableCell className="py-4">
        <p className="text-sm font-bold text-foreground group-hover:text-purple-500 transition-colors">{ticket.title}</p>
        <p className="text-[10px] font-medium text-muted-foreground">{ticket.requester_name} · {ticket.company_name || 'N/A'}</p>
      </TableCell>
      <TableCell className="py-4">
        <PriorityBadge priority={ticket.priority} size="sm" />
      </TableCell>
      <TableCell className="py-4 text-center">
        <StatusBadge status={ticket.status} />
      </TableCell>
      <TableCell className="py-4">
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatDate(ticket.updated_at, "dd MMM yy 'às' HH:mm", { locale: ptBR })}
        </span>
      </TableCell>
      <TableCell className="py-4 text-right pr-6">
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-purple-500 transition-colors inline-block" />
      </TableCell>
    </TableRow>
  );
});
TicketHistoryRow.displayName = 'TicketHistoryRow';
