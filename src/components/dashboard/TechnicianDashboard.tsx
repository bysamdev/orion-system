import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  PlayCircle, CheckCircle2, AlertTriangle, Clock, Loader2,
  HandHelping, User, Search, ChevronDown, ChevronUp, 
  ExternalLink, MousePointer2, ArrowRight, Filter, Info
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianStats, useTechnicianWorkload, useTeamWorkload } from '@/hooks/useTechnicianStats';
import { useMyActiveTickets, useSLAAtRiskTickets, useUnassignedTicketsEnhanced, useAllActiveTickets, useMyRecentClosedTickets, useActiveAgentsCount } from '@/hooks/useMyTickets';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SLABadge } from './SLABadge';
import { cn } from '@/lib/utils';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { Ticket, useAssumeTicket } from '@/hooks/useTickets';

// Carregado sob demanda: recharts só entra no bundle quando este
// widget é de fato renderizado, não no chunk padrão do dashboard.
const WorkloadChart = lazy(() => import('./WorkloadChart'));

// ──── Componente StatCard (Revitalizado) ────
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  description?: string;
  department?: string;
  active?: boolean;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, variant = 'default', description, active, onClick }) => {
  const styles = {
    default: 'text-primary bg-primary/10 border-primary/20',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };

  const glows = {
    default: 'ring-2 ring-primary/80 bg-primary/5 border-primary/40 shadow-sm',
    warning: 'ring-2 ring-amber-500/80 bg-amber-500/5 border-amber-500/40 shadow-sm',
    success: 'ring-2 ring-emerald-500/80 bg-emerald-500/5 border-emerald-500/40 shadow-sm',
    danger: 'ring-2 ring-rose-500/80 bg-rose-500/5 border-rose-500/40 shadow-sm',
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative group text-left p-5 rounded-2xl transition-all duration-200 overflow-hidden bg-card border border-border/50 hover:border-primary/40 shadow-xs hover:shadow-md h-full w-full",
        active 
          ? cn("scale-[1.01]", glows[variant])
          : "hover:scale-[1.005]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{value}</h3>
            {active && <ArrowRight className="w-4 h-4 text-primary shrink-0" />}
          </div>
          {description && <p className="text-xs font-medium text-muted-foreground truncate">{description}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105", styles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
};

// ──── Indicador de Tempo Decorrido com Horário Exato no Hover ────
const TimeAgoBadge: React.FC<{ date: string | Date | undefined | null }> = ({ date }) => {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground text-xs">—</span>;

  const timeAgo = formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  const exactTime = format(d, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground font-medium transition-colors cursor-help group/time">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/time:text-primary transition-colors shrink-0" />
          <span className="capitalize">{timeAgo}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover/95 backdrop-blur-sm border-border/60 shadow-xl text-xs px-3 py-1.5 rounded-xl z-50">
        <div className="space-y-0.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Horário de abertura</p>
          <p className="text-foreground font-mono font-semibold">{exactTime}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// ──── Linha de ticket na tabela (Revitalizada) ────
const TicketRow: React.FC<{ ticket: Ticket }> = React.memo(({ ticket }) => {
  const navigate = useNavigate();
  return (
    <TableRow
      className="group relative cursor-pointer border-b border-border/40 hover:bg-muted/30 transition-all"
    >
      <TableCell className="py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
        #{ticket.ticket_number}
      </TableCell>
      <TableCell className="py-4">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
            {ticket.title}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
            <span className="text-primary/70">{ticket.requester_name}</span>
            <span>·</span>
            <span className="truncate max-w-[120px]">{ticket.company_name || 'N/A'}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <PriorityBadge priority={ticket.priority} size="sm" />
      </TableCell>
      <TableCell className="py-4 text-center">
        <StatusBadge status={ticket.status} />
      </TableCell>
      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
        <TimeAgoBadge date={ticket.created_at} />
      </TableCell>
      <TableCell className="py-4">
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} />
      </TableCell>
      <TableCell className="py-4 text-right">
        <span className="text-2xs font-bold text-muted-foreground uppercase opacity-40 group-hover:opacity-100 transition-opacity">
          Ver detalhes <ArrowRight className="inline-block w-3 h-3 ml-1" />
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(`/ticket/${ticket.id}`); }}
          className="absolute inset-0 z-10"
        />
      </TableCell>
    </TableRow>
  );
});
TicketRow.displayName = 'TicketRow';

const UnassignedTicketRow: React.FC<{ ticket: Ticket; onAssume: (id: string) => void }> = React.memo(({ ticket: t, onAssume }) => {
  const navigate = useNavigate();
  return (
    <TableRow className="group relative border-b border-border/40 hover:bg-muted/30 transition-all cursor-pointer" onClick={() => navigate(`/ticket/${t.id}`)}>
      <TableCell className="py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
        #{t.ticket_number}
      </TableCell>
      <TableCell className="py-4">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
            {t.title}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
            <span className="text-primary/70">{t.requester_name}</span>
            <span>·</span>
            <span className="truncate max-w-[120px]">{t.company_name || 'N/A'}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <PriorityBadge priority={t.priority} size="sm" />
      </TableCell>
      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
        <TimeAgoBadge date={t.created_at} />
      </TableCell>
      <TableCell className="py-4">
        <SLABadge slaStatus={t.sla_status} slaDueDate={t.sla_due_date} createdAt={t.created_at} variant="compact" />
      </TableCell>
      <TableCell className="py-4 text-right pr-6">
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onAssume(t.id); }}
          className="h-8 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider relative z-20 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
        >
          <HandHelping className="w-3.5 h-3.5" /> Assumir
        </Button>
      </TableCell>
    </TableRow>
  );
});
UnassignedTicketRow.displayName = 'UnassignedTicketRow';

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();

  const { data: stats, isLoading: statsLoading } = useTechnicianStats(user?.id, role);
  const { data: workload, isLoading: workloadLoading } = useTechnicianWorkload(user?.id, role);
  const { data: myTickets = [], isLoading: myTicketsLoading } = useMyActiveTickets(user?.id);
  const { data: allActiveTickets = [], isLoading: allTicketsLoading } = useAllActiveTickets();
  const { data: slaTickets = [], isLoading: slaLoading } = useSLAAtRiskTickets();
  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedTicketsEnhanced();
  const { data: recentClosed = [], isLoading: closedLoading } = useMyRecentClosedTickets(user?.id);
  const { data: activeAgentsCount } = useActiveAgentsCount(profile?.company_id);

  const { data: teamWorkload, isLoading: teamWorkloadLoading } = useTeamWorkload(profile?.company_id);
  const assumeTicket = useAssumeTicket();

  const [searchTerm, setSearchTerm] = useState('');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('unassigned');
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);

  // Definir a aba inicial: se o técnico tem chamados próprios em atendimento, inicia em "Meus Chamados";
  // se não tem nenhum atribuído a si e há chamados na Fila de Espera, inicia em "Fila de Espera" ou "Todos os Chamados".
  React.useEffect(() => {
    if (initialTabSet) return;
    if (myTicketsLoading || unassignedLoading || allTicketsLoading) return;

    if (myTickets.length > 0) {
      setActiveTab('my-tickets');
    } else if (unassigned.length > 0) {
      setActiveTab('unassigned');
    } else if (allActiveTickets.length > 0) {
      setActiveTab('all-tickets');
    } else {
      setActiveTab('unassigned');
    }
    setInitialTabSet(true);
  }, [myTicketsLoading, unassignedLoading, allTicketsLoading, myTickets.length, unassigned.length, allActiveTickets.length, initialTabSet]);
  
  // Advanced filters state
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');

  useRealtimeTickets();

  const filteredUnassignedTickets = useMemo(() => {
    let result = [...unassigned];
    if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [unassigned, searchTerm, kpiFilter, priorityFilter, categoryFilter, companyFilter, slaFilter]);

  const filteredMyTickets = useMemo(() => {
    let result = [...myTickets];
    if (kpiFilter === 'in-progress') result = result.filter(t => t.status === 'in-progress');
    else if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    else if (kpiFilter === 'pending') result = result.filter(t => ['open', 'reopened', 'awaiting-customer'].includes(t.status));

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (technicianFilter !== 'all') result = result.filter(t => t.assigned_to === technicianFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [myTickets, searchTerm, kpiFilter, priorityFilter, categoryFilter, statusFilter, technicianFilter, companyFilter, slaFilter]);

  const filteredAllTickets = useMemo(() => {
    let result = [...allActiveTickets];
    if (kpiFilter === 'in-progress') result = result.filter(t => t.status === 'in-progress');
    else if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    else if (kpiFilter === 'pending') result = result.filter(t => ['open', 'reopened', 'awaiting-customer'].includes(t.status));

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (technicianFilter !== 'all') result = result.filter(t => t.assigned_to === technicianFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower) ||
        t.assigned_to?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [allActiveTickets, searchTerm, kpiFilter, priorityFilter, categoryFilter, statusFilter, technicianFilter, companyFilter, slaFilter]);

  const handleAssumeTicket = useCallback(async (ticketId: string) => {
    const technicianName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Técnico';
    const technicianId = user?.id;

    if (!technicianId) {
      toast({ 
        title: 'Erro de Autenticação', 
        description: 'Usuário não autenticado para assumir o chamado.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      await assumeTicket.mutateAsync({
        id: ticketId,
        userId: technicianId,
        userName: technicianName
      });
    } catch {
      // Error handled by mutation onError
    }
  }, [profile, user, assumeTicket, toast]);

  if (statsLoading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Sincronizando Dashboard...</span>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Alerta de ausência de agentes */}
      {activeAgentsCount === 0 && unassigned.length > 0 && (
        <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex items-start gap-3 text-destructive animate-in fade-in zoom-in duration-300">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h4 className="font-semibold text-sm">Atenção: Auto-atribuição Indisponível</h4>
            <p className="text-xs text-destructive/90 leading-relaxed">
              Existem {unassigned.length} ticket(s) na Fila de Espera, mas o sistema de auto-atribuição não encontrou agentes técnicos ou admins online/ativos para esta empresa. O roteamento automático foi pausado.
            </p>
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full h-full">
              <StatCard
                title="Em Atendimento"
                value={stats?.inProgress || 0}
                description="Tickets em atendimento ativo"
                icon={PlayCircle}
                active={kpiFilter === 'in-progress'}
                onClick={() => {
                  setKpiFilter(f => f === 'in-progress' ? null : 'in-progress');
                  setActiveTab('my-tickets');
                  document.getElementById('tickets-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            <p>Tickets em atendimento ativo</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full h-full">
              <StatCard
                title="SLA Crítico"
                value={stats?.slaAtRisk || 0}
                description="Tickets com prazo vencido"
                icon={AlertTriangle}
                variant={(stats?.slaAtRisk || 0) > 0 ? 'danger' : 'default'}
                active={kpiFilter === 'sla'}
                onClick={() => {
                  setKpiFilter(f => f === 'sla' ? null : 'sla');
                  setActiveTab('my-tickets');
                  document.getElementById('tickets-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            <p>Tickets com prazo vencido</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full h-full">
              <StatCard
                title="Minha Fila"
                value={stats?.pending || 0}
                description="Tickets pendentes na sua fila"
                icon={Clock}
                variant="warning"
                active={kpiFilter === 'pending'}
                onClick={() => {
                  setKpiFilter(f => f === 'pending' ? null : 'pending');
                  setActiveTab('my-tickets');
                  document.getElementById('tickets-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            <p>Tickets pendentes na sua fila</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full h-full">
              <StatCard
                title="Resolvidos Hoje"
                value={stats?.resolvedToday || 0}
                description="Tickets concluídos hoje"
                icon={CheckCircle2}
                variant="success"
                active={closedOpen}
                onClick={() => {
                  setClosedOpen(true);
                  setKpiFilter(null);
                  setActiveTab('my-tickets');
                  setTimeout(() => document.getElementById('closed-tickets-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            <p>Tickets concluídos hoje</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Team Workload Widget (Only for Admins) */}
      {(role === 'admin' || role === 'developer') && teamWorkload && teamWorkload.length > 0 && (
        <Card className="border-border/50 shadow-xs rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
          <CardHeader className="p-5 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Carga de Trabalho da Equipe</CardTitle>
                <CardDescription className="text-xs font-medium">Capacidade e pendências em tempo real</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest h-12 pl-6">Técnico</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 text-center">Em Aberto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 text-center">SLA em Risco</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 text-center">Resolvidos Hoje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamWorkload.map(tech => (
                  <TableRow key={tech.technician_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6 py-4 font-bold text-sm truncate">{tech.technician_name}</TableCell>
                    <TableCell className="text-center py-4">
                      <Badge variant="outline" className="font-bold">{tech.open_tickets}</Badge>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      {tech.sla_at_risk_tickets > 0 ? (
                        <Badge variant="destructive" className="font-bold">{tech.sla_at_risk_tickets}</Badge>
                      ) : (
                        <span className="text-muted-foreground font-medium text-xs">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <span className="text-emerald-500 font-bold">{tech.resolved_today}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Main Content Area */}
        <div className="xl:col-span-8 space-y-8 min-w-0">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                autoComplete="off"
                placeholder="Busque por #número, título ou cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-muted/20 border-border/40 hover:bg-muted/30 focus-visible:ring-primary/20 rounded-2xl transition-all"
              />
              {searchTerm && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {activeTab === 'unassigned' ? filteredUnassignedTickets.length : activeTab === 'my-tickets' ? filteredMyTickets.length : filteredAllTickets.length} {(activeTab === 'unassigned' ? filteredUnassignedTickets.length : activeTab === 'my-tickets' ? filteredMyTickets.length : filteredAllTickets.length) === 1 ? 'resultado' : 'resultados'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant={advancedFiltersOpen ? "default" : "outline"} 
                size="sm" 
                onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                className="rounded-2xl border-border/40 font-bold text-xs gap-2 transition-colors h-12 px-4"
              >
                <Filter className="w-3.5 h-3.5" /> Filtros Avançados
              </Button>
            </div>
          </div>

          {advancedFiltersOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-muted/10 rounded-2xl border border-border/40 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5 text-left">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Prioridade</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="bg-background/50 border-border/40">
                    <SelectValue placeholder="Todas as Prioridades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Prioridades</SelectItem>
                    <SelectItem value="urgent" className="text-destructive font-bold">Urgente</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-background/50 border-border/40">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in-progress">Em Atendimento</SelectItem>
                    <SelectItem value="awaiting-customer">Aguardando Cliente</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Categoria</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-background/50 border-border/40">
                    <SelectValue placeholder="Todas as Categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Categorias</SelectItem>
                    <SelectItem value="Sistema">Sistemas Corporativos</SelectItem>
                    <SelectItem value="Hardware">Hardware / Equipamentos</SelectItem>
                    <SelectItem value="Acesso">Acessos e Contas</SelectItem>
                    <SelectItem value="Dúvida">Dúvidas Técnicas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Status SLA</label>
                <Select value={slaFilter} onValueChange={setSlaFilter}>
                  <SelectTrigger className="bg-background/50 border-border/40">
                    <SelectValue placeholder="Todos os SLAs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os SLAs</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="attention" className="text-warning font-semibold">Em Atenção</SelectItem>
                    <SelectItem value="breached" className="text-destructive font-bold">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 text-left lg:col-span-2">
                <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Empresa / Cliente</label>
                <div className="relative">
                  <Input 
                    placeholder="Filtrar por nome da empresa..." 
                    value={companyFilter === 'all' ? '' : companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value || 'all')}
                    className="bg-background/50 border-border/40"
                  />
                </div>
              </div>
              
              <div className="lg:col-span-3 flex justify-end pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setPriorityFilter('all');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setCompanyFilter('all');
                    setSlaFilter('all');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          )}
          
          <div id="tickets-section" className="scroll-mt-6" />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="inline-flex">
                <TabsTrigger value="unassigned">
                  Fila de Espera ({unassigned.length})
                </TabsTrigger>
                <TabsTrigger value="my-tickets">
                  Meus Chamados ({filteredMyTickets.length})
                </TabsTrigger>
                <TabsTrigger value="all-tickets">
                  Todos os Chamados ({filteredAllTickets.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="unassigned" className="mt-0">
              <Card className="border-border/50 shadow-xs rounded-2xl overflow-hidden bg-card">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[750px]">
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-12">ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Descrição</TableHead>
                        <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-12">Prioridade</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12">Aberto Há</TableHead>
                        <TableHead className="w-[130px] text-[10px] font-black uppercase tracking-widest h-12">Prazo SLA</TableHead>
                        <TableHead className="w-[150px] h-12 text-right pr-6">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnassignedTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic text-xs">
                            {searchTerm || priorityFilter !== 'all' || categoryFilter !== 'all' || companyFilter !== 'all' || slaFilter !== 'all'
                              ? 'Nenhum chamado encontrado na fila de espera com os filtros aplicados.'
                              : 'Fila limpa! Nenhum chamado aguardando atendimento.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUnassignedTickets.map(t => (
                          <UnassignedTicketRow key={t.id} ticket={t} onAssume={handleAssumeTicket} />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="my-tickets" className="mt-0">
              <Card className="border-border/50 shadow-xs rounded-2xl overflow-hidden bg-card">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[750px]">
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-12">ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Descrição</TableHead>
                        <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-12">Prioridade</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12 text-center">Status</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12">Aberto Há</TableHead>
                        <TableHead className="w-[130px] text-[10px] font-black uppercase tracking-widest h-12">Prazo SLA</TableHead>
                        <TableHead className="w-[120px] h-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMyTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-xs">
                            Nenhum chamado encontrado nesta categoria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMyTickets.map(t => <TicketRow key={t.id} ticket={t} />)
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all-tickets" className="mt-0">
              <Card className="border-border/50 shadow-xs rounded-2xl overflow-hidden bg-card">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[750px]">
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-12">ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Descrição</TableHead>
                        <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-12">Prioridade</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12 text-center">Status</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12">Aberto Há</TableHead>
                        <TableHead className="w-[130px] text-[10px] font-black uppercase tracking-widest h-12">Prazo SLA</TableHead>
                        <TableHead className="w-[120px] h-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-xs">
                            Nenhum chamado ativo encontrado no momento.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllTickets.map(t => <TicketRow key={t.id} ticket={t} />)
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info Area */}
        <div className="xl:col-span-4 space-y-8 min-w-0">
          {/* Workload Section */}
          <Card className="border-border/50 shadow-xs rounded-2xl bg-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
                Sua Carga de Trabalho
                <MousePointer2 className="w-4 h-4 opacity-40" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workload && workload.length > 0 ? (
                <Suspense fallback={<div className="h-[240px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" /></div>}>
                  <WorkloadChart workload={workload} />
                </Suspense>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nada pendente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently Closed (Revitalized) */}
          <section id="closed-tickets-section" className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center justify-between">
              Fechados Recentemente
              <Clock className="w-3.5 h-3.5" />
            </h4>
            <div className="flex flex-col gap-2 h-full">
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {recentClosed.map(t => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/ticket/${t.id}`)}
                    className="w-full group p-3.5 rounded-2xl border border-border/40 bg-muted/15 hover:bg-primary/5 hover:border-primary/20 transition-all text-left flex items-center gap-3.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-background border border-border/40 flex items-center justify-center group-hover:scale-95 transition-transform">
                      <span className="text-[10px] font-mono font-bold">#{t.ticket_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{t.title}</p>
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">{t.requester_name}</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/historico')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary rounded-xl mt-2"
              >
                Ver histórico completo
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
