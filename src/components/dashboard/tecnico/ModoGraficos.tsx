import React, { useMemo } from 'react';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Ticket } from '@/hooks/useTickets';
import { calculateSlaStatus } from '@/lib/ticket-helpers';
import {
  getPriorityLabel, getRechartsPriorityColor, getRechartsStatusColor, getSlaConfig, getStatusLabel,
} from '@/lib/state-tokens';
import { CargaDeTecnico } from './CargaDaEquipe';

// Isolado e carregado com React.lazy: o recharts só é baixado por quem abre
// este modo.

interface Fatia {
  nome: string;
  valor: number;
  cor: string;
}

const DIA = 24 * 60 * 60 * 1000;
const COR_NEUTRA = '#94a3b8';
const COR_PRIMARIA = 'hsl(var(--primary))';

const estiloDaDica = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
  itemStyle: { color: 'hsl(var(--foreground))' },
  cursor: { fill: 'hsl(var(--muted) / 0.4)' },
};

const eixo = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

function contar<T>(itens: T[], chave: (item: T) => string) {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    const k = chave(item);
    mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  return mapa;
}

const Quadro: React.FC<{ titulo: string; descricao?: string; className?: string; children: React.ReactNode }> = ({ titulo, descricao, className, children }) => (
  <Card className={`border-border/50 rounded-xl bg-card ${className ?? ''}`}>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
      {descricao && <CardDescription className="text-xs">{descricao}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const SemDados: React.FC = () => (
  <p className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Nenhum chamado ativo.</p>
);

const Rosca: React.FC<{ fatias: Fatia[] }> = ({ fatias }) => {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  if (total === 0) return <SemDados />;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0}>
              {fatias.map(f => <Cell key={f.nome} fill={f.cor} />)}
            </Pie>
            <Tooltip {...estiloDaDica} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">ativos</span>
        </div>
      </div>
      <ul className="space-y-2 w-full">
        {fatias.map(f => (
          <li key={f.nome} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.cor }} />
            <span className="text-muted-foreground">{f.nome}</span>
            <span className="ml-auto font-semibold tabular-nums">{f.valor}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((f.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const BarrasDeitadas: React.FC<{ fatias: Fatia[] }> = ({ fatias }) => {
  if (fatias.length === 0) return <SemDados />;
  const altura = Math.max(160, fatias.length * 40);
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={fatias} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="nome" width={120} tick={eixo} axisLine={false} tickLine={false} />
          <Tooltip {...estiloDaDica} formatter={(v: number) => [v, 'Chamados']} />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={20}>
            {fatias.map(f => <Cell key={f.nome} fill={f.cor} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ModoGraficosProps {
  chamados: Ticket[];
  teamWorkload: CargaDeTecnico[] | undefined;
}

const ORDEM_DE_PRIORIDADE = ['urgent', 'high', 'medium', 'low'];
const ORDEM_DE_SLA = ['ok', 'warning', 'attention', 'breached'];
const FAIXAS_DE_IDADE = [
  { nome: 'Menos de 1 dia', ate: 1 },
  { nome: '1 a 3 dias', ate: 3 },
  { nome: '3 a 7 dias', ate: 7 },
  { nome: '7 a 30 dias', ate: 30 },
  { nome: 'Mais de 30 dias', ate: Infinity },
];

const ModoGraficos: React.FC<ModoGraficosProps> = ({ chamados, teamWorkload }) => {
  const dados = useMemo(() => {
    const porSla = contar(chamados, t => calculateSlaStatus(t.sla_due_date, t.created_at) ?? 'sem');
    const sla: Fatia[] = ORDEM_DE_SLA
      .map(k => ({ nome: getSlaConfig(k).label, valor: porSla.get(k) || 0, cor: getSlaConfig(k).rechartsColor }))
      .concat(porSla.get('sem') ? [{ nome: 'Sem SLA', valor: porSla.get('sem') || 0, cor: COR_NEUTRA }] : [])
      .filter(f => f.valor > 0);

    const porPrioridade = contar(chamados, t => t.priority);
    const prioridade: Fatia[] = ORDEM_DE_PRIORIDADE
      .filter(k => porPrioridade.get(k))
      .map(k => ({ nome: getPriorityLabel(k), valor: porPrioridade.get(k) || 0, cor: getRechartsPriorityColor(k) }));

    const porStatus = contar(chamados, t => t.status);
    const status: Fatia[] = [...porStatus.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ nome: getStatusLabel(k), valor: v, cor: getRechartsStatusColor(k) }));

    const agora = Date.now();
    const porIdade = contar(chamados, t => {
      const dias = (agora - new Date(t.created_at).getTime()) / DIA;
      return (FAIXAS_DE_IDADE.find(f => dias < f.ate) ?? FAIXAS_DE_IDADE[FAIXAS_DE_IDADE.length - 1]).nome;
    });
    const idade = FAIXAS_DE_IDADE.map(f => ({ nome: f.nome, valor: porIdade.get(f.nome) || 0 }));

    // Admin recebe a carga pronta do banco; técnico conta pelos chamados que vê.
    const carga: Fatia[] = teamWorkload && teamWorkload.length > 0
      ? teamWorkload
          .map(t => ({ nome: t.technician_name, valor: Number(t.open_tickets) || 0, cor: COR_PRIMARIA }))
          .sort((a, b) => b.valor - a.valor)
      : [...contar(chamados, t => t.assigned_to || 'Sem responsável').entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([nome, valor]) => ({ nome, valor, cor: nome === 'Sem responsável' ? COR_NEUTRA : COR_PRIMARIA }));

    return { sla, prioridade, status, idade, carga };
  }, [chamados, teamWorkload]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Quadro titulo="SLA dos chamados ativos" descricao="Situação do prazo agora">
        <Rosca fatias={dados.sla} />
      </Quadro>

      <Quadro titulo="Por prioridade">
        <Rosca fatias={dados.prioridade} />
      </Quadro>

      <Quadro titulo="Por status">
        <BarrasDeitadas fatias={dados.status} />
      </Quadro>

      <Quadro titulo="Carga por técnico" descricao="Chamados em aberto de cada um">
        <BarrasDeitadas fatias={dados.carga} />
      </Quadro>

      <Quadro titulo="Há quanto tempo estão abertos" className="lg:col-span-2">
        {chamados.length === 0 ? <SemDados /> : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.idade} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
                <Tooltip {...estiloDaDica} formatter={(v: number) => [v, 'Chamados']} />
                <Bar dataKey="valor" fill={COR_PRIMARIA} radius={[6, 6, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Quadro>
    </div>
  );
};

export default ModoGraficos;
