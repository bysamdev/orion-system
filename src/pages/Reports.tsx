import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { useReportMetrics, type ReportMode } from '@/hooks/useReportMetrics';
import { useReportTickets } from '@/hooks/useReportTickets';
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
import { Download, ShieldAlert, BarChart3, TrendingUp, Clock, AlertTriangle, Loader2, ArrowLeft, Printer, Repeat, CheckCircle2, Calendar, Activity } from 'lucide-react';

// Exported for testing
export const sanitizeCSV = (val: any) => {
  if (!val) return '""';
  let str = String(val);
  if (/^[=+\-@\t]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend } from 'recharts';
import { useNavigate, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const Reports: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Modo de visualização
  const [reportMode, setReportMode] = useState<ReportMode>('created');

  // Filtros
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');

  const companyId = companyFilter !== 'all' ? companyFilter : null;
  const techId = techFilter !== 'all' ? techFilter : null;

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

  // ── KPIs via RPC (banco) ────────────────────────────────────────────────
  const { data: kpis, isLoading: kpisLoading } = useReportMetrics({
    mode: reportMode,
    dateFrom,
    dateTo,
    companyId,
    techId,
  });

  // ── Lista de tickets via RPC (banco) — usada nos gráficos e CSV ────────
  const { data: tickets = [], isLoading: ticketsLoading } = useReportTickets({
    mode: reportMode,
    dateFrom,
    dateTo,
    companyId,
    techId,
  });

  // Rankings derivados da lista de tickets (client-side, apenas ordenação/slice)
  const rankings = useMemo(() => {
    const techRanking = tickets.reduce((acc: Record<string, number>, t) => {
      if (t.assigned_to) acc[t.assigned_to] = (acc[t.assigned_to] || 0) + 1;
      return acc;
    }, {});
    const companyRanking = tickets.reduce((acc: Record<string, number>, t) => {
      if (t.company_name) acc[t.company_name] = (acc[t.company_name] || 0) + 1;
      return acc;
    }, {});
    const categoryRanking = tickets.reduce((acc: Record<string, number>, t) => {
      const cat = t.category || 'Sem Categoria';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    return { techRanking, companyRanking, categoryRanking };
  }, [tickets]);

  // Aliases para compatibilidade com o JSX existente
  const metrics = {
    total: kpis?.total ?? 0,
    open: kpis?.abertos ?? 0,
    resolved: kpis?.resolvidos ?? 0,
    closed: kpis?.cancelados ?? 0,
    avgResolutionHours: kpis?.tempoMedioHoras ?? 0,
    slaBreached: kpis?.slaEstourado ?? 0,
    // SLA ok/attention derivados da lista de tickets
    slaOk: tickets.filter(t => t.sla_status === 'ok').length,
    slaAttention: tickets.filter(t => t.sla_status === 'attention').length,
    techRanking: rankings.techRanking,
    companyRanking: rankings.companyRanking,
    categoryRanking: rankings.categoryRanking,
  };

  // Transformar dados para os gráficos
  const chartData = useMemo(() => {
    // 1. Status Distribution
    const statusData = [
      { name: 'Aberto', value: metrics.open, color: 'hsl(var(--primary))' },
      { name: 'Resolvido/Fechado', value: metrics.resolved + metrics.closed, color: 'hsl(var(--success))' }
    ].filter(d => d.value > 0);

    // 2. SLA Distribution
    const slaData = [
      { name: 'No Prazo', value: metrics.slaOk, color: '#22c55e' },
      { name: 'Atenção', value: metrics.slaAttention, color: '#eab308' },
      { name: 'Estourado', value: metrics.slaBreached, color: '#ef4444' }
    ].filter(d => d.value > 0);

    // 3. Tickets por dia (apenas considerando criação dentro do período para o gráfico)
    const ticketsPerDay = tickets.reduce((acc: Record<string, number>, t) => {
      if (!t.created_at) return acc;
      const date = t.created_at.split('T')[0];
      if (date >= dateFrom && date <= dateTo) {
        if (!acc[date]) acc[date] = 0;
        acc[date]++;
      }
      return acc;
    }, {});
    const trendData = Object.entries(ticketsPerDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5. Técnico Ranking (Top 5)
    const technicianData = Object.entries(metrics.techRanking)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 6. Empresa Ranking (Top 5)
    const companyData = Object.entries(metrics.companyRanking)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. Categoria Ranking
    const categoryData = Object.entries(metrics.categoryRanking)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 4. Priority Distribution
    const priorityData = tickets.reduce((acc: Record<string, number>, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    const priorityChartData = Object.entries(priorityData).map(([name, value]) => ({
      name: name === 'urgent' ? 'Urgente' : name === 'high' ? 'Alta' : name === 'medium' ? 'Média' : 'Baixa',
      value,
      color: name === 'urgent' ? '#ef4444' : name === 'high' ? '#f97316' : name === 'medium' ? '#eab308' : '#22c55e'
    })).filter(d => d.value > 0);

    // ── NOVOS GRÁFICOS ──────────────────────────────────────────────────────

    // 8. MTTR por Categoria (tempo médio de resolução em horas)
    const mttrMap: Record<string, { totalMs: number; count: number }> = {};
    tickets.forEach(t => {
      if (!t.resolved_at || !t.created_at) return;
      const cat = t.category || 'Sem Categoria';
      const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      if (!mttrMap[cat]) mttrMap[cat] = { totalMs: 0, count: 0 };
      mttrMap[cat].totalMs += ms;
      mttrMap[cat].count++;
    });
    const mttrByCategoryData = Object.entries(mttrMap)
      .map(([name, { totalMs, count }]) => ({
        name,
        horas: Math.round((totalMs / count / 3_600_000) * 10) / 10,
      }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 8);

    // 9. Taxa de Reabertura por Técnico
    const reopenMap: Record<string, { total: number; reopened: number }> = {};
    tickets.forEach(t => {
      const tech = t.assigned_to || 'Sem Atribuição';
      if (!reopenMap[tech]) reopenMap[tech] = { total: 0, reopened: 0 };
      reopenMap[tech].total++;
      if (t.status === 'reopened') reopenMap[tech].reopened++;
    });
    const reopenRateByTechData = Object.entries(reopenMap)
      .filter(([, v]) => v.total >= 2)
      .map(([name, { total, reopened }]) => ({
        name: name.length > 18 ? name.slice(0, 18) + '…' : name,
        taxa: Math.round((reopened / total) * 100),
        total,
      }))
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 7);

    // 10. SLA cumprido vs estourado ao longo do tempo (por semana)
    const slaWeekMap: Record<string, { ok: number; breached: number; attention: number }> = {};
    tickets.forEach(t => {
      if (!t.created_at || !t.sla_status) return;
      const d = new Date(t.created_at);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      const weekKey = startOfWeek.toISOString().split('T')[0];
      if (!slaWeekMap[weekKey]) slaWeekMap[weekKey] = { ok: 0, breached: 0, attention: 0 };
      if (t.sla_status === 'ok') slaWeekMap[weekKey].ok++;
      else if (t.sla_status === 'breached') slaWeekMap[weekKey].breached++;
      else if (t.sla_status === 'attention') slaWeekMap[weekKey].attention++;
    });
    const slaTrendData = Object.entries(slaWeekMap)
      .map(([week, counts]) => ({ week: week.substring(5).replace('-', '/'), ...counts }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return { statusData, slaData, trendData, priorityChartData, technicianData, companyData, categoryData, mttrByCategoryData, reopenRateByTechData, slaTrendData };
  }, [tickets, metrics, dateFrom, dateTo]);

  const exportToCSV = () => {
    if (tickets.length === 0) return;

    const headers = ['ID', 'Título', 'Empresa', 'Solicitante', 'Prioridade', 'Status', 'SLA', 'Técnico', 'Criado Em', 'Resolvido Em'];
    const rows = tickets.map(t => [
      t.ticket_number,
      sanitizeCSV(t.title),
      sanitizeCSV(t.company_name),
      sanitizeCSV(t.requester_name),
      t.priority,
      t.status,
      t.sla_status || 'N/A',
      sanitizeCSV(t.assigned_to || ''),
      t.created_at,
      t.resolved_at || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_chamados_${dateFrom}_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Exportação concluída",
      description: "O relatório foi baixado com sucesso.",
      variant: "default",
    });
  };

  const printReport = () => {
    window.print();
  };

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
        
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Relatórios Gerenciais</h1>
            <p className="text-muted-foreground mt-1">Métricas, análise de desempenho e exportação de dados</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle de modo */}
            <div className="flex items-center rounded-lg border border-border bg-muted p-1 gap-1" role="group" aria-label="Modo de relatório">
              <button
                id="report-mode-created"
                onClick={() => setReportMode('created')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  reportMode === 'created'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Criados no Período
              </button>
              <button
                id="report-mode-active"
                onClick={() => setReportMode('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  reportMode === 'active'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Ativos no Período
              </button>
            </div>
            <Button variant="outline" onClick={exportToCSV} className="bg-background" disabled={tickets.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Exportar Planilha
            </Button>
            <Button onClick={printReport} disabled={tickets.length === 0}>
              <Printer className="w-4 h-4 mr-2" /> Salvar PDF / Imprimir
            </Button>
          </div>
        </div>

        {/* Cabeçalho exclusivo para impressão */}
        <div className="hidden print:block mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold">Relatório Gerencial de Chamados</h1>
          <p className="text-sm text-gray-500">Período: {dateFrom} a {dateTo}</p>
        </div>

        {/* Filtros */}
        <Card className="mb-6 print:hidden">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input autoComplete="off" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Input autoComplete="off" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
                  {kpisLoading ? <div className="h-7 w-10 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-bold text-foreground">{metrics.total}</p>}
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
                  {kpisLoading ? <div className="h-7 w-10 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-bold text-foreground">{metrics.open}</p>}
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
                  {kpisLoading ? <div className="h-7 w-10 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-bold text-foreground">{metrics.resolved + metrics.closed}</p>}
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
                  {kpisLoading ? <div className="h-7 w-16 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-bold text-foreground">{metrics.avgResolutionHours != null ? `${metrics.avgResolutionHours}h` : '—'}</p>}
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
                  {kpisLoading ? <div className="h-7 w-10 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-bold text-foreground">{metrics.slaBreached}</p>}
                  <p className="text-xs text-muted-foreground">SLA Estourado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos / Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 print:break-inside-avoid">
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Evolução do Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {chartData.trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => val.substring(5).replace('-', '/')} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados para exibir</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Distribuição de Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {chartData.statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData.statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {chartData.statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados para exibir</div>
                )}
              </div>
              <div className="flex justify-center gap-4 mt-2">
                 {chartData.statusData.map(d => (
                   <div key={d.name} className="flex items-center gap-1.5 align-middle text-xs font-bold">
                     <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: d.color }}></span>
                     {d.name}
                   </div>
                 ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Novos Gráficos Analíticos ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:break-inside-avoid">
          {/* MTTR por Categoria */}
          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" /> Tempo Médio de Resolução por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                {chartData.mttrByCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.mttrByCategoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }}
                        formatter={(val: number) => [`${val}h`, 'Tempo Médio']}
                      />
                      <Bar dataKey="horas" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem tickets resolvidos no período</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Taxa de Reabertura por Técnico */}
          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Repeat className="w-4 h-4" /> Taxa de Reabertura por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                {chartData.reopenRateByTechData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.reopenRateByTechData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }}
                        formatter={(val: number, _: string, props: { payload?: { total: number } }) => [
                          `${val}% (${props.payload?.total ?? 0} tickets)`,
                          'Taxa de Reabertura'
                        ]}
                      />
                      <Bar dataKey="taxa" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Dados insuficientes (&lt;2 tickets/técnico)</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SLA Cumprido vs Estourado ao Longo do Tempo */}
          <Card className="col-span-full shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> SLA Cumprido vs. Estourado ao Longo do Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                {chartData.slaTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.slaTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area type="monotone" dataKey="ok" name="No Prazo" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} />
                      <Area type="monotone" dataKey="attention" name="Atenção" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.3} strokeWidth={2} />
                      <Area type="monotone" dataKey="breached" name="Estourado" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados de SLA no período</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:break-inside-avoid">
          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Desempenho por Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {chartData.technicianData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.technicianData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center">Nenhum dado atribuído</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Volume por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {chartData.companyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.companyData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center">Sem dados de empresas</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Chamados por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                {chartData.categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.categoryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum dado de categorias</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SLA Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 print:break-inside-avoid">
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
                              slaStatus={ticket.sla_status}
                              slaDueDate={ticket.sla_due_date}
                              createdAt={ticket.created_at}
                              variant="compact"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[120px] truncate">
                            {ticket.assigned_to || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground capitalize-first">
                            {ticket.created_at && !isNaN(new Date(ticket.created_at).getTime()) ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR }) : "Desconhecido"}
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
