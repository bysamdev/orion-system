import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  PlayCircle, CheckCircle2, AlertTriangle, Clock, Loader2,
  HandHelping, User, Search, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianStats, useTechnicianWorkload } from '@/hooks/useTechnicianStats';
import { useMyActiveTickets, useSLAAtRiskTickets, useUnassignedTicketsEnhanced, useMyRecentClosedTickets } from '@/hooks/useMyTickets';
import { useUserProfile } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SLABadge } from './SLABadge';
import { cn } from '@/lib/utils';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { Ticket } from '@/hooks/useTickets';

// ──── Componente StatCard (clickável) ────
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  description?: string;
  active?: boolean;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, variant = 'default', description, active, onClick }) => {
  const variantStyles = {
    default: 'bg-card border-border',
    warning: 'bg-warning/10 border-warning/30',
    success: 'bg-success/10 border-success/30',
    danger: 'bg-destructive/10 border-destructive/30',
  };
  const iconStyles = {
    default: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    danger: 'text-destructive',
  };

  return (
    <Card 
      className={cn(
        `${variantStyles[variant]} border cursor-pointer transition-all hover:shadow-md`,
        active && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={`p-3 rounded-full bg-background ${iconStyles[variant]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ──── Linha de ticket na tabela ────
interface TicketRowProps {
  ticket: Ticket;
  onClick: () => void;
}

const TicketRow: React.FC<TicketRowProps> = ({ ticket, onClick }) => {
  const slaRowClass = ticket.sla_status === 'breached' 
    ? 'border-l-4 border-l-destructive' 
    : ticket.sla_status === 'attention' 
      ? 'border-l-4 border-l-warning' 
      : '';

  return (
    <TableRow
      className={cn('hover:bg-muted/30 cursor-pointer transition-colors', slaRowClass)}
      onClick={onClick}
    >
      <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">
        #{ticket.ticket_number}
      </TableCell>
      <TableCell className="max-w-[200px]">
        <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
        <p className="text-xs text-muted-foreground truncate">{ticket.requester_name}</p>
      </TableCell>
      <TableCell className="max-w-[120px]">
        <span className="text-sm text-muted-foreground truncate block">{ticket.company_name || 'N/A'}</span>
      </TableCell>
      <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
      <TableCell><StatusBadge status={ticket.status} /></TableCell>
      <TableCell>
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} variant="compact" />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(ticket.created_at), { locale: ptBR, addSuffix: true })}
      </TableCell>
    </TableRow>
  );
};

// ──── Dashboard Principal ────
export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();

  const { data: stats, isLoading: statsLoading } = useTechnicianStats(user?.id);
  const { data: workload, isLoading: workloadLoading } = useTechnicianWorkload(user?.id);
  const { data: myTickets = [], isLoading: myTicketsLoading } = useMyActiveTickets(user?.id);
  const { data: slaTickets = [], isLoading: slaLoading } = useSLAAtRiskTickets();
  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedTicketsEnhanced();
  const { data: recentClosed = [], isLoading: closedLoading } = useMyRecentClosedTickets(user?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  useRealtimeTickets();

  // Filtros para "Meus Tickets"
  const filteredMyTickets = useMemo(() => {
    let result = [...myTickets];

    // Filtro por KPI
    if (kpiFilter === 'in-progress') {
      result = result.filter(t => t.status === 'in-progress');
    } else if (kpiFilter === 'sla') {
      result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    } else if (kpiFilter === 'pending') {
      result = result.filter(t => ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party'].includes(t.status));
    }

    // Busca por texto
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        (t.company_name || '').toLowerCase().includes(lower)
      );
    }

    return result;
  }, [myTickets, searchTerm, kpiFilter]);

  // Filtro de busca para SLA
  const filteredSLATickets = useMemo(() => {
    if (!searchTerm) return slaTickets;
    const lower = searchTerm.toLowerCase();
    return slaTickets.filter(t =>
      t.title.toLowerCase().includes(lower) ||
      t.ticket_number.toString().includes(lower) ||
      t.requester_name.toLowerCase().includes(lower)
    );
  }, [slaTickets, searchTerm]);

  const handleKpiClick = (filter: string) => {
    setKpiFilter(prev => prev === filter ? null : filter);
  };

  const handleAssumeTicket = async (ticketId: string) => {
    if (!profile?.full_name) return;
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: profile.full_name, status: 'in-progress' })
        .eq('id', ticketId);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Ticket assumido com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['technician-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível assumir o ticket', variant: 'destructive' });
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Em Atendimento"
          value={stats?.inProgress || 0}
          icon={<PlayCircle className="w-6 h-6" />}
          variant="default"
          description="Tickets em andamento"
          active={kpiFilter === 'in-progress'}
          onClick={() => handleKpiClick('in-progress')}
        />
        <StatCard
          title="Resolvidos Hoje"
          value={stats?.resolvedToday || 0}
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="success"
          description="Finalizados nas últimas 24h"
          active={kpiFilter === 'resolved'}
          onClick={() => handleKpiClick('resolved')}
        />
        <StatCard
          title="SLA em Risco"
          value={stats?.slaAtRisk || 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          variant={stats?.slaAtRisk && stats.slaAtRisk > 0 ? 'danger' : 'default'}
          description="Prazo < 4 horas"
          active={kpiFilter === 'sla'}
          onClick={() => handleKpiClick('sla')}
        />
        <StatCard
          title="Meus Pendentes"
          value={stats?.pending || 0}
          icon={<Clock className="w-6 h-6" />}
          variant="warning"
          description="Aguardando ação"
          active={kpiFilter === 'pending'}
          onClick={() => handleKpiClick('pending')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por #número, título, solicitante, empresa..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs Meus Tickets / SLA em Risco */}
          <Tabs defaultValue="my-tickets" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="my-tickets" className="gap-2">
                <User className="w-4 h-4" />
                Meus Tickets ({filteredMyTickets.length})
              </TabsTrigger>
              <TabsTrigger value="sla-risk" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                SLA em Risco ({filteredSLATickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-tickets">
              <Card>
                <CardContent className="p-0">
                  {myTicketsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredMyTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-10 h-10 mb-2 text-success" />
                      <p className="text-sm">{searchTerm || kpiFilter ? 'Nenhum resultado encontrado' : 'Nenhum ticket ativo!'}</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Ticket</TableHead>
                          <TableHead>Título / Solicitante</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>Criado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMyTickets.map(ticket => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sla-risk">
              <Card>
                <CardContent className="p-0">
                  {slaLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredSLATickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-10 h-10 mb-2 text-success" />
                      <p className="text-sm">Nenhum ticket com SLA em risco!</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Ticket</TableHead>
                          <TableHead>Título / Solicitante</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>Responsável</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSLATickets.map(ticket => (
                          <TableRow
                            key={ticket.id}
                            className={cn(
                              'hover:bg-muted/30 cursor-pointer transition-colors',
                              ticket.sla_status === 'breached' ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-warning'
                            )}
                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                          >
                            <TableCell className="font-mono font-medium">#{ticket.ticket_number}</TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm font-medium truncate">{ticket.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{ticket.requester_name}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{ticket.company_name || 'N/A'}</TableCell>
                            <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                            <TableCell><StatusBadge status={ticket.status} /></TableCell>
                            <TableCell>
                              <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} variant="compact" />
                            </TableCell>
                            <TableCell className="text-sm">{ticket.assigned_to || 'Não atribuído'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Fechados Recentes (colapsável) */}
          <Collapsible open={closedOpen} onOpenChange={setClosedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Fechados Recentes ({recentClosed.length})
                    </span>
                    {closedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {closedLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : recentClosed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum chamado fechado recentemente.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentClosed.map(ticket => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-sm font-medium">#{ticket.ticket_number}</span>
                            <span className="text-sm truncate">{ticket.title}</span>
                          </div>
                          <StatusBadge status={ticket.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fila Geral */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <HandHelping className="w-5 h-5 text-primary" />
                Fila Geral
              </CardTitle>
              <CardDescription>Tickets aguardando atribuição</CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : unassigned.length > 0 ? (
                <div className="space-y-3">
                  {unassigned.map(ticket => (
                    <div key={ticket.id} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                            className="text-sm font-medium text-foreground hover:text-primary truncate block text-left w-full"
                          >
                            #{ticket.ticket_number} - {ticket.title}
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <PriorityBadge priority={ticket.priority} />
                            <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} variant="compact" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {ticket.company_name || ticket.requester_name}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleAssumeTicket(ticket.id)} className="shrink-0">
                          Assumir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-success" />
                  <p className="text-sm">Nenhum ticket na fila!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Minha Carga de Trabalho */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Minha Carga
              </CardTitle>
              <CardDescription>Distribuição por status</CardDescription>
            </CardHeader>
            <CardContent>
              {workloadLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : workload && workload.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={workload} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {workload.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Totalizador central */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-10px' }}>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{workload.reduce((sum, w) => sum + w.value, 0)}</p>
                      <p className="text-xs text-muted-foreground">ativos</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
                  <p className="text-sm">Nenhum ticket pendente!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
