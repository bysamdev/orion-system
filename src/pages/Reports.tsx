import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { SLABadge } from '@/components/dashboard/SLABadge';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, ArrowLeft, BarChart3, Clock, CheckCircle2, AlertTriangle, TrendingUp, ShieldAlert } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Reports: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  // Filtros
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');

  // Buscar empresas para filtro
  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data, error } = await supabaseRead.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Buscar técnicos para filtro
  const { data: technicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('profiles')
        .select('id, full_name, user_roles!inner(role)')
        .in('user_roles.role', ['technician', 'admin', 'developer'])
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Buscar tickets filtrados
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['report-tickets', dateFrom, dateTo, companyFilter, techFilter],
    queryFn: async () => {
      let query = supabaseRead
        .from('tickets')
        .select('id, ticket_number, title, status, priority, sla_status, sla_due_date, created_at, resolved_at, first_response_at, assigned_to, assigned_to_user_id, company_id, requester_name')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (companyFilter && companyFilter !== 'all') {
        query = query.eq('company_id', companyFilter);
      }
      if (techFilter && techFilter !== 'all') {
        query = query.eq('assigned_to_user_id', techFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enriquecer com company_name
      if (!data || data.length === 0) return [];
      const companyIds = [...new Set(data.map(t => t.company_id))];
      const { data: companyData } = await supabaseRead
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyMap = new Map(companyData?.map(c => [c.id, c.name]) || []);

      return data.map(t => ({ ...t, company_name: companyMap.get(t.company_id) || 'N/A' }));
    },
  });

  // Calcular métricas
  const metrics = useMemo(() => {
    const open = tickets.filter(t => ['open', 'in-progress', 'reopened', 'awaiting-customer', 'awaiting-third-party'].includes(t.status)).length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const closed = tickets.filter(t => ['closed', 'cancelled'].includes(t.status)).length;

    // Tempo médio de resolução (em horas)
    const resolvedTickets = tickets.filter(t => t.resolved_at && t.created_at);
    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((acc, t) => {
        return acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolvedTickets.length / 3600000) * 10) / 10;
    }

    // SLA compliance
    const withSla = tickets.filter(t => t.sla_status);
    const slaOk = withSla.filter(t => t.sla_status === 'ok').length;
    const slaAttention = withSla.filter(t => t.sla_status === 'attention').length;
    const slaBreached = withSla.filter(t => t.sla_status === 'breached').length;

    return { open, resolved, closed, total: tickets.length, avgResolutionHours, slaOk, slaAttention, slaBreached };
  }, [tickets]);

  // Loading state
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // RBAC: Clientes não podem acessar relatórios
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
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar os relatórios.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Métricas e análise de desempenho por período</p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Técnico</Label>
                <Select value={techFilter} onValueChange={setTechFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {technicians?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
                  <p className="text-xs text-muted-foreground">Total no Período</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.open}</p>
                  <p className="text-xs text-muted-foreground">Abertos/Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.resolved + metrics.closed}</p>
                  <p className="text-xs text-muted-foreground">Resolvidos/Fechados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <TrendingUp className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.avgResolutionHours}h</p>
                  <p className="text-xs text-muted-foreground">Tempo Médio Resolução</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.slaBreached}</p>
                  <p className="text-xs text-muted-foreground">SLA Estourado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SLA Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA No Prazo</p>
                <p className="text-xl font-bold text-green-600">{metrics.slaOk}</p>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                {metrics.total > 0 ? Math.round((metrics.slaOk / metrics.total) * 100) : 0}%
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA Atenção</p>
                <p className="text-xl font-bold text-yellow-600">{metrics.slaAttention}</p>
              </div>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                {metrics.total > 0 ? Math.round((metrics.slaAttention / metrics.total) * 100) : 0}%
              </Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA Estourado</p>
                <p className="text-xl font-bold text-red-600">{metrics.slaBreached}</p>
              </div>
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                {metrics.total > 0 ? Math.round((metrics.slaBreached / metrics.total) * 100) : 0}%
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tickets no Período
              <span className="ml-2 text-sm font-normal text-muted-foreground">({tickets.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Criado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nenhum ticket encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map(ticket => (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                        >
                          <TableCell className="font-mono font-medium">#{ticket.ticket_number}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{ticket.title}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[120px] truncate">{ticket.company_name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[120px] truncate">{ticket.requester_name}</TableCell>
                          <TableCell><PriorityBadge priority={ticket.priority} size="sm" /></TableCell>
                          <TableCell><StatusBadge status={ticket.status} /></TableCell>
                          <TableCell>
                            <SLABadge
                              slaStatus={ticket.sla_status as any}
                              slaDueDate={ticket.sla_due_date}
                              variant="compact"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[120px] truncate">
                            {ticket.assigned_to || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;
