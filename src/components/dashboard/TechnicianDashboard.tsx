import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  PlayCircle, CheckCircle2, AlertTriangle, Clock, Loader2,
  HandHelping, User, Search, ChevronDown, ChevronUp, 
  ExternalLink, MousePointer2, ArrowRight, Filter
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

// ──── Componente StatCard (Revitalizado) ────
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  description?: string;
  active?: boolean;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, variant = 'default', description, active, onClick }) => {
  const styles = {
    default: 'hover:border-primary/50 text-primary bg-primary/5',
    warning: 'hover:border-amber-500/50 text-amber-500 bg-amber-500/5',
    success: 'hover:border-emerald-500/50 text-emerald-500 bg-emerald-500/5',
    danger: 'hover:border-rose-500/50 text-rose-500 bg-rose-500/5',
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative group text-left p-6 rounded-3xl border transition-all duration-300 overflow-hidden",
        active 
          ? "border-primary bg-primary/10 shadow-xl shadow-primary/5 ring-1 ring-primary/20 scale-[1.02]" 
          : "border-border/40 bg-card/50 hover:bg-card hover:shadow-lg"
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black tracking-tighter">{value}</h3>
            {active && <ArrowRight className="w-4 h-4 text-primary animate-pulse" />}
          </div>
          {description && <p className="text-[10px] font-medium text-muted-foreground">{description}</p>}
        </div>
        <div className={cn("p-3 rounded-2xl transition-all group-hover:rotate-12", styles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </button>
  );
};

// ──── Linha de ticket na tabela (Revitalizada) ────
const TicketRow: React.FC<{ ticket: Ticket; onAction: () => void }> = ({ ticket, onAction }) => {
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
      <TableCell className="py-4">
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} variant="compact" />
      </TableCell>
      <TableCell className="py-4 text-right">
        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">
          Ver detalhes <ArrowRight className="inline-block w-3 h-3 ml-1" />
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(`/ticket/${ticket.id}`); }}
          className="absolute inset-0 z-10"
        />
      </TableCell>
    </TableRow>
  );
};

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

  const filteredMyTickets = useMemo(() => {
    let result = [...myTickets];
    if (kpiFilter === 'in-progress') result = result.filter(t => t.status === 'in-progress');
    else if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    else if (kpiFilter === 'pending') result = result.filter(t => ['open', 'reopened', 'awaiting-customer'].includes(t.status));

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [myTickets, searchTerm, kpiFilter]);

  const handleAssumeTicket = async (ticketId: string) => {
    if (!profile?.full_name) return;
    try {
      const { error } = await supabase.from('tickets').update({ assigned_to: profile.full_name, status: 'in-progress' }).eq('id', ticketId);
      if (error) throw error;
      toast({ title: 'Ticket Assumido', description: 'Você agora é o responsável por este chamado.' });
      queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-tickets'] });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  if (statsLoading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Sincronizando Dashboard...</span>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Em Atendimento"
          value={stats?.inProgress || 0}
          icon={PlayCircle}
          active={kpiFilter === 'in-progress'}
          onClick={() => setKpiFilter(f => f === 'in-progress' ? null : 'in-progress')}
        />
        <StatCard
          title="SLA Crítico"
          value={stats?.slaAtRisk || 0}
          icon={AlertTriangle}
          variant={(stats?.slaAtRisk || 0) > 0 ? 'danger' : 'default'}
          active={kpiFilter === 'sla'}
          onClick={() => setKpiFilter(f => f === 'sla' ? null : 'sla')}
        />
        <StatCard
          title="Minha Fila"
          value={stats?.pending || 0}
          icon={Clock}
          variant="warning"
          active={kpiFilter === 'pending'}
          onClick={() => setKpiFilter(f => f === 'pending' ? null : 'pending')}
        />
        <StatCard
          title="Resolvidos Hoje"
          value={stats?.resolvedToday || 0}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Busque por #número, título ou cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-muted/20 border-border/40 hover:bg-muted/30 focus-visible:ring-primary/20 rounded-2xl transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl border-border/40 font-bold text-xs gap-2">
                <Filter className="w-3.5 h-3.5" /> Filtros Avançados
              </Button>
            </div>
          </div>

          <Tabs defaultValue="my-tickets" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-muted/10 p-1 rounded-2xl border border-border/40">
                <TabsTrigger value="my-tickets" className="rounded-xl px-6 py-2 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                  Meus Chamados
                </TabsTrigger>
                <TabsTrigger value="unassigned" className="rounded-xl px-6 py-2 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                  Fila de Espera
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="my-tickets" className="mt-0">
              <Card className="border-border/40 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest h-12">ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Descrição</TableHead>
                        <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest h-12">Prioridade</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-12 text-center">Status</TableHead>
                        <TableHead className="w-[130px] text-[10px] font-black uppercase tracking-widest h-12">Prazo SLA</TableHead>
                        <TableHead className="w-[120px] h-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMyTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic text-xs">
                            Nenhum chamado encontrado nesta categoria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMyTickets.map(t => <TicketRow key={t.id} ticket={t} onAction={() => {}} />)
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="unassigned" className="mt-0">
              <Card className="border-border/40 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {unassigned.length === 0 ? (
                        <TableRow><TableCell className="h-48 text-center text-xs text-muted-foreground">Fila limpa! Ótimo trabalho.</TableCell></TableRow>
                      ) : (
                        unassigned.map(t => (
                          <TableRow key={t.id} className="group hover:bg-muted/30 border-b border-border/40">
                            <TableCell className="font-mono text-[11px] font-bold text-muted-foreground/60">#{t.ticket_number}</TableCell>
                            <TableCell>
                              <p className="text-sm font-bold text-foreground">{t.title}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">{t.requester_name} · {t.company_name}</p>
                            </TableCell>
                            <TableCell>
                              <SLABadge slaStatus={t.sla_status} slaDueDate={t.sla_due_date} variant="compact" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => handleAssumeTicket(t.id)} className="h-8 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                Assumir <HandHelping className="ml-2 w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info Area */}
        <div className="lg:col-span-4 space-y-8">
          {/* Workload Section */}
          <Card className="border-border/40 shadow-lg rounded-3xl bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
                Sua Carga de Trabalho
                <MousePointer2 className="w-4 h-4 opacity-40" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workload && workload.length > 0 ? (
                <div className="h-[240px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={workload} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                        {workload.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', fontSize: '12px' }} 
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black tracking-tighter">{workload.reduce((a, b) => a + b.value, 0)}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Tickets</span>
                  </div>
                </div>
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
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center justify-between">
              Fechados Recentemente
              <Clock className="w-3.5 h-3.5" />
            </h4>
            <div className="space-y-2">
              {recentClosed.slice(0, 3).map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/ticket/${t.id}`)}
                  className="w-full group p-4 rounded-2xl border border-border/40 bg-muted/10 hover:bg-primary/5 hover:border-primary/20 transition-all text-left flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-background border border-border/40 flex items-center justify-center group-hover:scale-90 transition-transform">
                    <span className="text-[10px] font-mono font-bold">#{t.ticket_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{t.title}</p>
                    <p className="text-[9px] font-medium text-muted-foreground uppercase">Técnico designado</p>
                  </div>
                </button>
              ))}
              {recentClosed.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary rounded-xl">
                  Ver histórico completo
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
