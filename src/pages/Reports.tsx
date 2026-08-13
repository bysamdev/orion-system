import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTickets } from '@/hooks/useTickets';
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
import { useCompanies } from '@/hooks/useCompanies';
import {
  Loader2,
  ArrowLeft,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Download,
  FileSpreadsheet,
  Printer,
  Repeat,
  Server,
  Users,
  Timer,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
  LabelList,
} from 'recharts';
import { useNavigate, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { BulletChart } from '@/components/reports/BulletChart';
import { GaugeChart } from '@/components/reports/GaugeChart';
import { TechnicianComparisonChart } from '@/components/reports/TechnicianComparisonChart';
import {
  useSlaTarget,
  useTicketRatings,
  useTimeEntriesReport,
  useCriticalAssets,
} from '@/hooks/useReportSources';
import {
  filterTickets,
  computeMetrics,
  computeTrend,
  computeSlaTrend,
  computeByTechnician,
  computeByCompany,
  computeByCategory,
  computeByPriority,
  computeMttrByCategory,
  computeReopenRateByTech,
  computeBulletKpis,
  computeTechnicianComparison,
  computeHoursByTechnician,
} from '@/lib/reports/aggregations';
import { SLA_COMPLIANCE_TARGET_PCT, type ReportMode } from '@/lib/reports/types';

// Marcação usada pela exportação em PDF para localizar e vetorizar os gráficos.
// O título viaja junto para o PDF não depender da ordem dos nós.
const chartAttrs = (titulo: string) => ({
  'data-report-chart': '',
  'data-report-chart-title': titulo,
});

const TOOLTIP_STYLE = { backgroundColor: 'hsl(var(--background))', borderRadius: '8px' } as const;

const SemDados: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-4">
    {children ?? 'Sem dados para exibir'}
  </div>
);

const Reports: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<ReportMode>('resumido');
  const [exporting, setExporting] = useState<null | 'pdf' | 'xlsx'>(null);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');

  const { data: companies } = useCompanies();

  const { data: technicians } = useQuery({
    queryKey: ['technicians-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_roles!inner(role)')
        .in('user_roles.role', ['technician', 'admin', 'developer'])
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allTickets = [], isLoading: ticketsLoading } = useTickets();
  const { data: slaTarget = null } = useSlaTarget(companyFilter);
  const { data: ratings } = useTicketRatings();
  const { data: timeEntries } = useTimeEntriesReport();
  const { data: criticalAssets } = useCriticalAssets(companyFilter);

  const tickets = useMemo(
    () =>
      filterTickets(allTickets, {
        dateFrom,
        dateTo,
        companyId: companyFilter,
        technicianId: techFilter,
      }),
    [allTickets, dateFrom, dateTo, companyFilter, techFilter],
  );

  const metrics = useMemo(() => computeMetrics(tickets), [tickets]);

  const nomePorUsuario = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of technicians ?? []) m.set(t.id, t.full_name ?? '—');
    return m;
  }, [technicians]);

  const charts = useMemo(
    () => ({
      trend: computeTrend(tickets, dateFrom, dateTo),
      slaTrend: computeSlaTrend(tickets),
      porTecnico: computeByTechnician(tickets),
      porEmpresa: computeByCompany(tickets),
      porCategoria: computeByCategory(tickets),
      porPrioridade: computeByPriority(tickets),
      mttr: computeMttrByCategory(tickets),
      reabertura: computeReopenRateByTech(tickets),
      bullets: computeBulletKpis(tickets, slaTarget),
      comparativo: computeTechnicianComparison(tickets, ratings ?? new Map()),
      horas: computeHoursByTechnician(timeEntries ?? [], tickets, nomePorUsuario),
    }),
    [tickets, dateFrom, dateTo, slaTarget, ratings, timeEntries, nomePorUsuario],
  );

  const filtrosAtuais = useMemo(
    () => ({
      dateFrom,
      dateTo,
      companyId: companyFilter,
      companyName:
        companyFilter === 'all'
          ? 'Todas'
          : companies?.find((c) => c.id === companyFilter)?.name ?? companyFilter,
      technicianId: techFilter,
      technicianName:
        techFilter === 'all' ? 'Todos' : nomePorUsuario.get(techFilter) ?? techFilter,
    }),
    [dateFrom, dateTo, companyFilter, techFilter, companies, nomePorUsuario],
  );

  // ── Exportações ────────────────────────────────────────────────────────────
  // Ambas operam sobre `tickets` (já filtrado) e sobre os nós de gráfico
  // efetivamente renderizados no modo atual — nunca exportam fora do escopo
  // que o usuário está vendo.

  const exportarPdf = useCallback(async () => {
    setExporting('pdf');
    try {
      const { gerarPdf, nomeArquivo, baixarBlob } = await import('@/lib/reports/exportPdf');
      const chartNodes = Array.from(
        document.querySelectorAll<HTMLElement>('[data-report-chart]'),
      );
      const blob = await gerarPdf({
        mode,
        filters: filtrosAtuais,
        metrics,
        slaTarget,
        bulletKpis: charts.bullets,
        tickets,
        chartNodes,
      });
      baixarBlob(blob, nomeArquivo(mode, filtrosAtuais, 'pdf'));
      toast({
        title: 'PDF gerado',
        description: `Relatório ${mode} com ${chartNodes.length} gráficos vetoriais.`,
      });
    } catch (err) {
      console.error('Falha ao gerar PDF:', err);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível montar o documento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  }, [mode, filtrosAtuais, metrics, slaTarget, charts.bullets, tickets, toast]);

  const exportarXlsx = useCallback(async () => {
    setExporting('xlsx');
    try {
      const { gerarXlsx } = await import('@/lib/reports/exportXlsx');
      const { nomeArquivo, baixarBlob } = await import('@/lib/reports/exportPdf');
      const blob = await gerarXlsx({
        filters: filtrosAtuais,
        metrics,
        tickets,
        porTecnico: charts.comparativo,
        mttrPorCategoria: charts.mttr,
        horasPorTecnico: charts.horas,
      });
      baixarBlob(blob, nomeArquivo(mode, filtrosAtuais, 'xlsx'));
      toast({
        title: 'Planilha gerada',
        description: `${tickets.length} chamados exportados com abas de análise.`,
      });
    } catch (err) {
      console.error('Falha ao gerar XLSX:', err);
      toast({
        title: 'Erro ao gerar planilha',
        description: 'Não foi possível montar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  }, [mode, filtrosAtuais, metrics, tickets, charts.comparativo, charts.mttr, charts.horas, toast]);

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'customer') return <Navigate to="/" replace />;

  if (role !== 'admin' && role !== 'developer' && role !== 'technician') {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
              <p className="text-sm text-muted-foreground">
                Você não tem permissão para acessar os relatórios.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const detalhado = mode === 'detalhado';
  const semTickets = tickets.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Relatórios Gerenciais</h1>
            <p className="text-muted-foreground mt-1">
              Métricas, análise de desempenho e exportação de dados
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Alternador de modo */}
            <div
              className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
              role="group"
              aria-label="Modo do relatório"
            >
              {(['resumido', 'detalhado'] as ReportMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize',
                    mode === m
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={exportarXlsx}
                disabled={semTickets || exporting !== null}
                className="bg-background"
              >
                {exporting === 'xlsx' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                {exporting === 'xlsx' ? 'Gerando...' : 'Planilha (XLSX)'}
              </Button>
              {/* Fallback preservado: se a geração vetorial falhar em algum
                  ambiente, o usuário ainda consegue um PDF pela impressão do
                  navegador. Some da própria impressão via print:hidden. */}
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={semTickets || exporting !== null}
                className="bg-background print:hidden"
                title="Alternativa: gerar PDF pela impressão do navegador"
              >
                <Printer className="w-4 h-4" />
                <span className="sr-only">Imprimir</span>
              </Button>
              <Button onClick={exportarPdf} disabled={semTickets || exporting !== null}>
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {exporting === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input
                  autoComplete="off"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Input
                  autoComplete="off"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Técnico</Label>
                <Select value={techFilter} onValueChange={setTechFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {technicians?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { icon: BarChart3, cor: 'text-primary bg-primary/10', valor: metrics.total, rotulo: 'Total no Período' },
            { icon: Clock, cor: 'text-blue-500 bg-blue-500/10', valor: metrics.open, rotulo: 'Abertos/Ativos' },
            {
              icon: CheckCircle2,
              cor: 'text-green-500 bg-green-500/10',
              valor: metrics.resolved + metrics.closed,
              rotulo: 'Resolvidos/Fechados',
            },
            {
              icon: TrendingUp,
              cor: 'text-warning bg-warning/10',
              valor: `${metrics.avgResolutionHours}h`,
              rotulo: 'Tempo Médio Resolução',
            },
            {
              icon: AlertTriangle,
              cor: 'text-destructive bg-destructive/10',
              valor: metrics.slaBreached,
              rotulo: 'SLA Estourado',
            },
          ].map((k) => (
            <Card key={k.rotulo}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', k.cor.split(' ')[1])}>
                    <k.icon className={cn('h-5 w-5', k.cor.split(' ')[0])} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{k.valor}</p>
                    <p className="text-xs text-muted-foreground">{k.rotulo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Bloco executivo: Gauge + Bullets + Ativos ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Cumprimento de SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center pt-2" {...chartAttrs('Cumprimento de SLA')}>
              <GaugeChart
                value={metrics.slaCompliancePct}
                target={SLA_COMPLIANCE_TARGET_PCT}
                label="Chamados no prazo"
                sampleSize={metrics.slaAvaliados}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/40 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Timer className="w-4 h-4" /> Tempo de Resolução vs. Meta Contratual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {charts.bullets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {charts.bullets.map((k) => (
                    <BulletChart key={k.label} kpi={k} />
                  ))}
                </div>
              ) : (
                <div className="h-[140px]">
                  <SemDados>
                    {slaTarget
                      ? 'Nenhum chamado resolvido no período para comparar com a meta.'
                      : 'Nenhuma configuração de SLA cadastrada — sem meta contratual para comparar.'}
                  </SemDados>
                </div>
              )}
              {slaTarget && (
                <p className="text-[10px] text-muted-foreground mt-3">
                  Meta de origem: {slaTarget.sourceName}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ativos críticos (RMM) */}
        {criticalAssets && criticalAssets.total > 0 && (
          <Card className="mb-8 shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4" /> Ativos Críticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-destructive">{criticalAssets.offline}</p>
                  <p className="text-xs text-muted-foreground">Offline</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{criticalAssets.alerta}</p>
                  <p className="text-xs text-muted-foreground">Em alerta</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{criticalAssets.total}</p>
                  <p className="text-xs text-muted-foreground">Total monitorado</p>
                </div>
                {criticalAssets.exemplos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-auto">
                    {criticalAssets.exemplos.map((a) => (
                      <Badge key={a.name} variant="outline" className="text-[10px]">
                        {a.hostname || a.name} · {a.status}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tendência + categorias (ambos os modos) ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Evolução do Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full" {...chartAttrs('Evolução do Volume')}>
                {charts.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: string) => v.substring(5).replace('-', '/')}
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Chamados"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <SemDados />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Chamados por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Bar horizontal em vez de pizza: mais legível com 5+ fatias e
                  permite rótulo de valor em cada barra. */}
              <div className="h-[250px] w-full" {...chartAttrs('Chamados por Categoria')}>
                {charts.porCategoria.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.porCategoria} layout="vertical" margin={{ right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Chamados" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16}>
                        <LabelList dataKey="count" position="right" fontSize={9} fill="hsl(var(--foreground))" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <SemDados />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── A partir daqui: exclusivo do modo detalhado ───────────────────── */}
        {detalhado && (
          <>
            <Card className="mb-8 shadow-sm border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> Comparativo de Técnicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full" {...chartAttrs('Comparativo de Técnicos')}>
                  <TechnicianComparisonChart data={charts.comparativo} />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-sm border-border/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Tempo Médio por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full" {...chartAttrs('Tempo Médio de Resolução por Categoria')}>
                    {charts.mttr.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.mttr} layout="vertical" margin={{ right: 34 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                          <YAxis dataKey="name" type="category" width={104} tick={{ fontSize: 9 }} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(v: number, _n: string, p: { payload?: { amostra: number } }) => [
                              `${v}h (${p.payload?.amostra ?? 0} resolvidos)`,
                              'Tempo médio',
                            ]}
                          />
                          <Bar dataKey="horas" name="Tempo médio" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} barSize={16}>
                            <LabelList
                              dataKey="horas"
                              position="right"
                              fontSize={9}
                              fill="hsl(var(--foreground))"
                              formatter={(v: number) => `${v}h`}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <SemDados>Sem chamados resolvidos no período</SemDados>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Repeat className="w-4 h-4" /> Taxa de Reabertura por Técnico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full" {...chartAttrs('Taxa de Reabertura por Técnico')}>
                    {charts.reabertura.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.reabertura} layout="vertical" margin={{ right: 34 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                          <YAxis dataKey="name" type="category" width={104} tick={{ fontSize: 9 }} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(v: number, _n: string, p: { payload?: { total: number } }) => [
                              `${v}% de ${p.payload?.total ?? 0} chamados`,
                              'Reabertura',
                            ]}
                          />
                          <Bar dataKey="taxa" name="Reabertura" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={16}>
                            <LabelList
                              dataKey="taxa"
                              position="right"
                              fontSize={9}
                              fill="hsl(var(--foreground))"
                              formatter={(v: number) => `${v}%`}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <SemDados>Dados insuficientes (menos de 2 chamados por técnico)</SemDados>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-full shadow-sm border-border/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> SLA Cumprido vs. Estourado ao Longo do Tempo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px] w-full" {...chartAttrs('SLA ao Longo do Tempo')}>
                    {charts.slaTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={charts.slaTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                          <Area type="monotone" dataKey="ok" name="No Prazo" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} />
                          <Area type="monotone" dataKey="attention" name="Atenção" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.3} strokeWidth={2} />
                          <Area type="monotone" dataKey="breached" name="Estourado" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <SemDados>Sem dados de SLA no período</SemDados>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-sm border-border/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Volume por Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full" {...chartAttrs('Volume por Empresa')}>
                    {charts.porEmpresa.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.porEmpresa} layout="vertical" margin={{ right: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={116} tick={{ fontSize: 9 }} />
                          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="count" name="Chamados" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16}>
                            <LabelList dataKey="count" position="right" fontSize={9} fill="hsl(var(--foreground))" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <SemDados>Sem dados de empresas</SemDados>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Distribuição por Prioridade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full" {...chartAttrs('Distribuição por Prioridade')}>
                    {charts.porPrioridade.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.porPrioridade} layout="vertical" margin={{ right: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10 }} />
                          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="value" name="Chamados" radius={[0, 4, 4, 0]} barSize={18} fill="hsl(var(--primary))">
                            <LabelList dataKey="value" position="right" fontSize={9} fill="hsl(var(--foreground))" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <SemDados />
                    )}
                  </div>
                </CardContent>
              </Card>

              {charts.horas.length > 0 && (
                <Card className="col-span-full shadow-sm border-border/40">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Timer className="w-4 h-4" /> Horas Lançadas por Técnico
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[260px] w-full" {...chartAttrs('Horas Lançadas por Técnico')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.horas} margin={{ top: 18 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                          <YAxis tick={{ fontSize: 10 }} unit="h" />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}h`, '']} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                          <Bar dataKey="totalHoras" name="Total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="totalHoras" position="top" fontSize={9} fill="hsl(var(--foreground))" />
                          </Bar>
                          <Bar dataKey="faturaveisHoras" name="Faturáveis" fill="hsl(var(--success))" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="faturaveisHoras" position="top" fontSize={9} fill="hsl(var(--foreground))" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {/* ── Resumo de SLA ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { rotulo: 'SLA No Prazo', valor: metrics.slaOk, borda: 'border-l-green-500', texto: 'text-green-600', badge: 'bg-green-500/10 text-green-700 border-green-500/20' },
            { rotulo: 'SLA Atenção', valor: metrics.slaAttention, borda: 'border-l-yellow-500', texto: 'text-yellow-600', badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
            { rotulo: 'SLA Estourado', valor: metrics.slaBreached, borda: 'border-l-red-500', texto: 'text-red-600', badge: 'bg-red-500/10 text-red-700 border-red-500/20' },
          ].map((s) => (
            <Card key={s.rotulo} className={cn('border-l-4', s.borda)}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{s.rotulo}</p>
                  <p className={cn('text-xl font-bold', s.texto)}>{s.valor}</p>
                </div>
                {/* Percentual sobre os chamados avaliados por SLA, não sobre o
                    total — dividir pelo total subestimava o indicador. */}
                <Badge variant="outline" className={s.badge}>
                  {metrics.slaAvaliados > 0 ? Math.round((s.valor / metrics.slaAvaliados) * 100) : 0}%
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabela (somente no detalhado) ────────────────────────────────── */}
        {detalhado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Chamados no Período
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
                      {semTickets ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Nenhum chamado encontrado para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tickets.map((ticket) => (
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
                              {ticket.created_at && !Number.isNaN(new Date(ticket.created_at).getTime())
                                ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })
                                : 'Desconhecido'}
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
        )}

        {/* No modo resumido a tabela some, então o total precisa aparecer aqui. */}
        {!detalhado && (
          <p className="text-xs text-muted-foreground text-center">
            {tickets.length} chamados no período · troque para o modo <strong>detalhado</strong> para ver
            a tabela analítica e o comparativo por técnico.
          </p>
        )}
      </main>
    </div>
  );
};

export default Reports;
