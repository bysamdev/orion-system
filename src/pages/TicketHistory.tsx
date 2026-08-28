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
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Navigate } from 'react-router-dom'; // Added Navigate import
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { ptBR } from 'date-fns/locale';
import { formatDate } from '@/lib/utils';
import { useMeusTickets } from '@/hooks/useMyTickets';
import { PageHeader } from '@/components/shared/PageHeader';
import { useProfilesMap, resolveUserDisplayName } from '@/hooks/useUserDisplayName';

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
  const { profilesMap } = useProfilesMap();

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

  const { data: queryResult, isLoading } = useMeusTickets(profile?.id, role, {
    statusFilter,
    priorityFilter,
    searchTerm: debouncedSearch,
    page,
    pageSize: PAGE_SIZE
  });

  const filteredTickets = queryResult?.data || [];
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
        
        <PageHeader
          icon={History}
          badge="AUDITORIA & REGISTROS"
          title="Histórico"
          description="Consulte chamados resolvidos, fechados ou cancelados com filtros avançados."
        />

        <Card className="border-border/40 shadow-xl shadow-primary/5 overflow-visible bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40 pb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-lg group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  autoComplete="off"
                  placeholder="Buscar por #número, ID, usuário, título ou empresa..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-12 h-10 bg-muted/20 border-border/40 hover:bg-muted/30 focus-visible:ring-primary/20 rounded-md transition-all text-sm"
                />
              </div>
              <div className="flex gap-2">
                {(statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm !== '') && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-10 rounded-md px-4 text-xs font-bold uppercase tracking-wider">
                    <X className="w-4 h-4 mr-2" /> Limpar
                  </Button>
                )}
                <Button 
                  variant={advancedOpen ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="h-10 rounded-md border-border/40 font-bold text-xs uppercase tracking-wider px-5 transition-colors shadow-sm"
                >
                  <Filter className="w-4 h-4 mr-2" /> Filtros Analíticos
                </Button>
              </div>
            </div>

            {advancedOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-muted/20 rounded-lg border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</label>
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="h-10 bg-background border-border/40 rounded-md">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="resolved">Resolvidos</SelectItem>
                      <SelectItem value="closed">Fechados</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                      <SelectItem value="open">Abertos</SelectItem>
                      <SelectItem value="in-progress">Em Atendimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Prioridade</label>
                  <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
                    <SelectTrigger className="h-10 bg-background border-border/40 rounded-md">
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
              <>
                {/* ── Mobile Card List (< md) ── */}
                <div className="md:hidden divide-y divide-border/40">
                  {filteredTickets.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm p-12 font-medium">
                      Nenhum ticket encontrado.
                    </p>
                  ) : (filteredTickets || []).map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleRowClick(t.id)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground/60">#{t.ticket_number}</span>
                          <StatusBadge status={t.status} />
                          <PriorityBadge priority={t.priority} size="sm" />
                        </div>
                        <p className="text-sm font-bold text-foreground truncate">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">{resolveUserDisplayName(t.requester_name, profilesMap, { fallback: 'Cliente' })} · {formatDate(t.updated_at, "dd/MM/yy", { locale: ptBR })}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>

                {/* ── Desktop Table (>= md) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-14 pl-6">Nº</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-14">Ticket</TableHead>
                        <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-14">Prioridade</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-14">Situação Final</TableHead>
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
                        (filteredTickets || []).map(t => (
                          <TicketHistoryRow key={t.id} ticket={t} profilesMap={profilesMap} onClick={handleRowClick} />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
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
                      className="w-9 p-0"
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
                      className="w-9 p-0"
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
  profilesMap?: any;
  onClick: (id: string) => void;
}

const TicketHistoryRow = React.memo(({ ticket, profilesMap, onClick }: TicketHistoryRowProps) => {
  const requesterDisplay = resolveUserDisplayName(ticket.requester_name, profilesMap, { fallback: 'Cliente' });
  return (
    <TableRow 
      onClick={() => onClick(ticket.id)} 
      className="group cursor-pointer border-b border-border/40 hover:bg-muted/30 transition-all"
    >
      <TableCell className="pl-6 py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
        #{ticket.ticket_number}
      </TableCell>
      <TableCell className="py-4">
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{ticket.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground/80">{requesterDisplay}</span>
          {ticket.company_name && <span>· {ticket.company_name}</span>}
          {ticket.category && (
            <span className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[9px] uppercase tracking-wider">
              {ticket.category}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-4">
        <PriorityBadge priority={ticket.priority} size="sm" />
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge status={ticket.status} />
      </TableCell>
      <TableCell className="py-4">
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatDate(ticket.updated_at, "dd MMM yy 'às' HH:mm", { locale: ptBR })}
        </span>
      </TableCell>
      <TableCell className="py-4 text-right pr-6">
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors inline-block" />
      </TableCell>
    </TableRow>
  );
});
TicketHistoryRow.displayName = 'TicketHistoryRow';
