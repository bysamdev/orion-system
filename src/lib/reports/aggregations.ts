// Agregações do relatório — TypeScript puro, sem React e sem API de browser.
//
// Extraído dos useMemo de src/pages/Reports.tsx. O objetivo da extração é que a
// mesma lógica alimente a tela, o PDF, o XLSX e (futuramente) o relatório
// agendado por e-mail rodando em Deno, sem três implementações divergentes.

import type { Ticket } from '@/hooks/useTickets';
import type {
  BulletKpi,
  HoursByTechnician,
  MttrByCategory,
  NamedCount,
  PriorityDatum,
  PriorityKey,
  ReopenRateByTech,
  ReportMetrics,
  SlaTarget,
  SlaTrendPoint,
  TechnicianComparison,
  TrendPoint,
} from './types';

const MS_POR_HORA = 3_600_000;

/** Status considerados "em aberto" — espelha o critério usado no Dashboard. */
export const STATUS_ATIVOS = [
  'open',
  'in-progress',
  'reopened',
  'awaiting-customer',
  'awaiting-third-party',
] as const;

const SEM_CATEGORIA = 'Sem Categoria';
const SEM_ATRIBUICAO = 'Sem Atribuição';

const arredonda1 = (n: number) => Math.round(n * 10) / 10;

/** Horas entre criação e resolução. null quando alguma das pontas falta. */
function horasDeResolucao(t: Ticket): number | null {
  if (!t.resolved_at || !t.created_at) return null;
  const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / MS_POR_HORA;
}

export function isAtivo(t: Ticket): boolean {
  return (STATUS_ATIVOS as readonly string[]).includes(t.status);
}

// ─── Filtro ───────────────────────────────────────────────────────────────────

export interface FilterArgs {
  dateFrom: string;
  dateTo: string;
  companyId: string;
  technicianId: string;
}

/**
 * Recorta os tickets pelo período/empresa/técnico.
 *
 * Mantém o critério que já existia na tela: um ticket entra se foi criado OU
 * resolvido dentro da janela, ou se segue ativo — assim o relatório não perde
 * de vista o que está em aberto há mais tempo que o período consultado.
 */
export function filterTickets(tickets: Ticket[], f: FilterArgs): Ticket[] {
  return (tickets || []).filter((t) => {
    if (f.companyId !== 'all' && t.company_id !== f.companyId) return false;
    if (f.technicianId !== 'all' && t.assigned_to_user_id !== f.technicianId) return false;

    const ativo = isAtivo(t);
    if (!t.created_at) return ativo;

    const criadoEm = t.created_at.split('T')[0];
    const criadoNoPeriodo = criadoEm >= f.dateFrom && criadoEm <= f.dateTo;

    let resolvidoNoPeriodo = false;
    if (t.resolved_at) {
      const resolvidoEm = t.resolved_at.split('T')[0];
      resolvidoNoPeriodo = resolvidoEm >= f.dateFrom && resolvidoEm <= f.dateTo;
    }

    return criadoNoPeriodo || resolvidoNoPeriodo || ativo;
  });
}

// ─── Métricas de topo ─────────────────────────────────────────────────────────

export function computeMetrics(tickets: Ticket[]): ReportMetrics {
  const open = tickets.filter(isAtivo).length;
  const resolved = tickets.filter((t) => t.status === 'resolved').length;
  const closed = tickets.filter((t) => ['closed', 'cancelled'].includes(t.status)).length;

  const horas = tickets.map(horasDeResolucao).filter((h): h is number => h !== null);
  const avgResolutionHours = horas.length
    ? arredonda1(horas.reduce((a, b) => a + b, 0) / horas.length)
    : 0;

  const comSla = tickets.filter((t) => t.sla_status);
  const slaOk = comSla.filter((t) => t.sla_status === 'ok').length;
  const slaAttention = comSla.filter((t) => t.sla_status === 'attention').length;
  const slaBreached = comSla.filter((t) => t.sla_status === 'breached').length;

  // Percentual sobre os chamados EFETIVAMENTE avaliados, não sobre o total.
  // Dividir pelo total (como os cards antigos faziam) subestima o cumprimento
  // sempre que há tickets sem SLA definido.
  const slaCompliancePct = comSla.length ? Math.round((slaOk / comSla.length) * 100) : 0;

  return {
    total: tickets.length,
    open,
    resolved,
    closed,
    avgResolutionHours,
    slaOk,
    slaAttention,
    slaBreached,
    slaCompliancePct,
    slaAvaliados: comSla.length,
  };
}

// ─── Séries temporais ─────────────────────────────────────────────────────────

export function computeTrend(tickets: Ticket[], dateFrom: string, dateTo: string): TrendPoint[] {
  const porDia: Record<string, number> = {};
  for (const t of tickets) {
    if (!t.created_at) continue;
    const dia = t.created_at.split('T')[0];
    if (dia < dateFrom || dia > dateTo) continue;
    porDia[dia] = (porDia[dia] || 0) + 1;
  }
  return Object.entries(porDia)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeSlaTrend(tickets: Ticket[]): SlaTrendPoint[] {
  const porSemana: Record<string, { ok: number; attention: number; breached: number }> = {};
  for (const t of tickets) {
    if (!t.created_at || !t.sla_status) continue;
    const d = new Date(t.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const inicioSemana = new Date(d);
    inicioSemana.setDate(d.getDate() - d.getDay());
    const chave = inicioSemana.toISOString().split('T')[0];
    if (!porSemana[chave]) porSemana[chave] = { ok: 0, attention: 0, breached: 0 };
    if (t.sla_status === 'ok') porSemana[chave].ok++;
    else if (t.sla_status === 'breached') porSemana[chave].breached++;
    else if (t.sla_status === 'attention') porSemana[chave].attention++;
  }
  // Ordena pela chave ISO completa antes de encurtar o rótulo — ordenar pelo
  // rótulo "MM/DD" quebra na virada de ano.
  return Object.entries(porSemana)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, c]) => ({ week: iso.substring(5).replace('-', '/'), ...c }));
}

// ─── Distribuições ────────────────────────────────────────────────────────────

function contaPor(tickets: Ticket[], chave: (t: Ticket) => string | null): NamedCount[] {
  const mapa: Record<string, number> = {};
  for (const t of tickets) {
    const k = chave(t);
    if (!k) continue;
    mapa[k] = (mapa[k] || 0) + 1;
  }
  return Object.entries(mapa)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export const computeByTechnician = (t: Ticket[], limite = 5) =>
  contaPor(t, (x) => x.assigned_to).slice(0, limite);

export const computeByCompany = (t: Ticket[], limite = 5) =>
  contaPor(t, (x) => x.company_name).slice(0, limite);

export const computeByCategory = (t: Ticket[], limite = 8) =>
  contaPor(t, (x) => x.category || SEM_CATEGORIA).slice(0, limite);

const ROTULO_PRIORIDADE: Record<PriorityKey, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const COR_PRIORIDADE: Record<PriorityKey, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

/**
 * Distribuição por prioridade.
 *
 * Já era calculada na tela antiga porém nunca renderizada (código morto);
 * agora alimenta o bar horizontal do modo detalhado.
 */
export function computeByPriority(tickets: Ticket[]): PriorityDatum[] {
  const ordem: PriorityKey[] = ['urgent', 'high', 'medium', 'low'];
  const mapa: Record<string, number> = {};
  for (const t of tickets) mapa[t.priority] = (mapa[t.priority] || 0) + 1;
  return ordem
    .filter((p) => (mapa[p] || 0) > 0)
    .map((p) => ({ name: ROTULO_PRIORIDADE[p], value: mapa[p], color: COR_PRIORIDADE[p] }));
}

// ─── MTTR e reabertura ────────────────────────────────────────────────────────

export function computeMttrByCategory(tickets: Ticket[], limite = 8): MttrByCategory[] {
  const mapa: Record<string, { horas: number; n: number }> = {};
  for (const t of tickets) {
    const h = horasDeResolucao(t);
    if (h === null) continue;
    const cat = t.category || SEM_CATEGORIA;
    if (!mapa[cat]) mapa[cat] = { horas: 0, n: 0 };
    mapa[cat].horas += h;
    mapa[cat].n++;
  }
  return Object.entries(mapa)
    .map(([name, { horas, n }]) => ({ name, horas: arredonda1(horas / n), amostra: n }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, limite);
}

export function computeReopenRateByTech(tickets: Ticket[], limite = 7): ReopenRateByTech[] {
  const mapa: Record<string, { total: number; reabertos: number }> = {};
  for (const t of tickets) {
    const tech = t.assigned_to || SEM_ATRIBUICAO;
    if (!mapa[tech]) mapa[tech] = { total: 0, reabertos: 0 };
    mapa[tech].total++;
    if (t.status === 'reopened') mapa[tech].reabertos++;
  }
  return Object.entries(mapa)
    .filter(([, v]) => v.total >= 2) // amostra < 2 gera 0% ou 100% sem significado
    .map(([name, { total, reabertos }]) => ({
      name,
      taxa: Math.round((reabertos / total) * 100),
      total,
    }))
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, limite);
}

// ─── Bullet KPIs (medido vs. meta contratual) ─────────────────────────────────

/**
 * MTTR por prioridade confrontado com a meta de `sla_configs`.
 *
 * Só entram prioridades com pelo menos um ticket resolvido — sem amostra não há
 * média, e exibir "0h contra meta de 4h" leria como excelência quando na verdade
 * é ausência de dado.
 */
export function computeBulletKpis(tickets: Ticket[], target: SlaTarget | null): BulletKpi[] {
  if (!target) return [];

  const metaPorPrioridade: Record<PriorityKey, number> = {
    urgent: target.urgentHours,
    high: target.highHours,
    medium: target.mediumHours,
    low: target.lowHours,
  };

  const kpis: BulletKpi[] = [];
  for (const p of ['urgent', 'high', 'medium', 'low'] as PriorityKey[]) {
    const doGrupo = tickets.filter((t) => t.priority === p);
    const horas = doGrupo.map(horasDeResolucao).filter((h): h is number => h !== null);
    if (horas.length === 0) continue;
    const meta = metaPorPrioridade[p];
    if (!Number.isFinite(meta) || meta <= 0) continue;

    kpis.push({
      label: `MTTR ${ROTULO_PRIORIDADE[p]}`,
      value: arredonda1(horas.reduce((a, b) => a + b, 0) / horas.length),
      target: meta,
      unit: 'h',
      betterWhen: 'lower',
      sampleSize: horas.length,
    });
  }
  return kpis;
}

// ─── Comparativo de técnicos (Grouped Bar) ────────────────────────────────────

/**
 * Compara técnicos em volume, cumprimento de SLA e satisfação.
 *
 * `csatPct` fica null quando o técnico não tem nenhuma avaliação no período — a
 * UI deve omitir a barra nesse caso, jamais plotar zero (zero leria como
 * "péssimo" em vez de "sem dados").
 */
export function computeTechnicianComparison(
  tickets: Ticket[],
  ratingsPorTicket: Map<string, number>,
  limite = 6,
): TechnicianComparison[] {
  const mapa: Record<
    string,
    { volume: number; slaOk: number; slaAvaliados: number; somaNotas: number; nNotas: number }
  > = {};

  for (const t of tickets) {
    const tech = t.assigned_to;
    if (!tech) continue;
    if (!mapa[tech]) {
      mapa[tech] = { volume: 0, slaOk: 0, slaAvaliados: 0, somaNotas: 0, nNotas: 0 };
    }
    const e = mapa[tech];
    e.volume++;
    if (t.sla_status) {
      e.slaAvaliados++;
      if (t.sla_status === 'ok') e.slaOk++;
    }
    const nota = ratingsPorTicket.get(t.id);
    if (typeof nota === 'number') {
      e.somaNotas += nota;
      e.nNotas++;
    }
  }

  return Object.entries(mapa)
    .map(([name, e]) => ({
      name,
      volume: e.volume,
      slaPct: e.slaAvaliados ? Math.round((e.slaOk / e.slaAvaliados) * 100) : 0,
      // Nota 1-5 normalizada para 0-100 para dividir eixo com os percentuais.
      csatPct: e.nNotas ? Math.round((e.somaNotas / e.nNotas / 5) * 100) : null,
      csatAmostra: e.nNotas,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limite);
}

// ─── Horas trabalhadas (time_entries) ─────────────────────────────────────────

export interface TimeEntryRow {
  user_id: string;
  ticket_id: string;
  duration_minutes: number | null;
  billable: boolean;
}

/**
 * Soma horas lançadas por técnico, restrita aos tickets já filtrados na tela —
 * caso contrário a exportação vazaria horas de chamados fora do escopo visto.
 */
export function computeHoursByTechnician(
  entries: TimeEntryRow[],
  ticketsNoEscopo: Ticket[],
  nomePorUsuario: Map<string, string>,
  limite = 8,
): HoursByTechnician[] {
  const idsNoEscopo = new Set(ticketsNoEscopo.map((t) => t.id));
  const mapa: Record<string, { total: number; faturaveis: number }> = {};

  for (const e of entries) {
    if (!idsNoEscopo.has(e.ticket_id)) continue;
    const minutos = e.duration_minutes ?? 0;
    if (minutos <= 0) continue;
    const nome = nomePorUsuario.get(e.user_id) || SEM_ATRIBUICAO;
    if (!mapa[nome]) mapa[nome] = { total: 0, faturaveis: 0 };
    mapa[nome].total += minutos;
    if (e.billable) mapa[nome].faturaveis += minutos;
  }

  return Object.entries(mapa)
    .map(([name, v]) => ({
      name,
      totalHoras: arredonda1(v.total / 60),
      faturaveisHoras: arredonda1(v.faturaveis / 60),
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras)
    .slice(0, limite);
}
