// Tipos compartilhados do módulo de relatórios.
//
// Este módulo é deliberadamente livre de React e de qualquer API de browser:
// as funções de agregação são TypeScript puro para poderem ser importadas
// tanto pela página (src/pages/Reports.tsx) quanto, futuramente, por uma
// Supabase Edge Function (Deno) no relatório agendado por e-mail — que é onde
// já vive a infra de envio (invite-user-resend, send-password-changed-alert).

/** Modo de leitura do relatório. Controla quais blocos são exibidos/exportados. */
export type ReportMode = 'resumido' | 'detalhado';

/** Prioridades de ticket — espelha o union de Ticket['priority']. */
export type PriorityKey = 'urgent' | 'high' | 'medium' | 'low';

/** Filtros aplicados na tela. Exportações precisam respeitar exatamente estes. */
export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  companyId: string;
  companyName: string;
  technicianId: string;
  technicianName: string;
}

/**
 * Meta de horas por prioridade, vinda de `sla_configs`.
 *
 * É a meta contratual real do cliente — não um valor arbitrado aqui. Quando a
 * empresa filtrada não tem config própria, cai no padrão da tabela (se houver);
 * sem nenhuma config, os bullets que dependem de meta são omitidos em vez de
 * exibirem um alvo inventado.
 */
export interface SlaTarget {
  urgentHours: number;
  highHours: number;
  mediumHours: number;
  lowHours: number;
  /** Nome da configuração de origem, exibido no PDF para rastreabilidade. */
  sourceName: string;
}

/**
 * Meta de % de chamados dentro do SLA.
 *
 * Diferente de SlaTarget, este número NÃO existe no banco: `sla_configs` define
 * prazo por prioridade, não percentual de cumprimento. É uma constante de
 * negócio, centralizada aqui para virar campo configurável depois sem caça ao
 * valor espalhado pelo código. Exibida na UI rotulada como "meta".
 */
export const SLA_COMPLIANCE_TARGET_PCT = 95;

/** Um KPI comparado contra meta — alimenta os Bullet Charts. */
export interface BulletKpi {
  label: string;
  /** Valor medido. */
  value: number;
  /** Meta contratual. */
  target: number;
  unit: string;
  /**
   * Direção que representa sucesso. 'lower' = menor é melhor (tempo de
   * resolução), 'higher' = maior é melhor (% de cumprimento).
   */
  betterWhen: 'lower' | 'higher';
  /** Quantidade de itens que compõem a medição, para honestidade estatística. */
  sampleSize: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface SlaTrendPoint {
  week: string;
  ok: number;
  attention: number;
  breached: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface MttrByCategory {
  name: string;
  horas: number;
  /** Nº de tickets resolvidos que geraram essa média. */
  amostra: number;
}

export interface ReopenRateByTech {
  name: string;
  taxa: number;
  total: number;
}

export interface PriorityDatum {
  name: string;
  value: number;
  color: string;
}

/** Linha do comparativo multidimensional de técnicos (Grouped Bar). */
export interface TechnicianComparison {
  name: string;
  volume: number;
  /** % de chamados do técnico dentro do SLA. */
  slaPct: number;
  /** Média de satisfação (1-5) convertida para escala 0-100. null se sem avaliações. */
  csatPct: number | null;
  /** Nº de avaliações que compõem o CSAT. 0 = sem dados. */
  csatAmostra: number;
}

export interface HoursByTechnician {
  name: string;
  totalHoras: number;
  faturaveisHoras: number;
}

/** Métricas de topo (cards de KPI). */
export interface ReportMetrics {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  avgResolutionHours: number;
  slaOk: number;
  slaAttention: number;
  slaBreached: number;
  /** % de chamados com SLA cumprido, entre os que possuem status de SLA. */
  slaCompliancePct: number;
  /** Nº de chamados com status de SLA — denominador do percentual acima. */
  slaAvaliados: number;
}

export interface HoursByCompany {
  name: string;
  totalHoras: number;
  faturaveisHoras: number;
}

export interface TechReopenCsat {
  name: string;
  taxaReabertura: number;
  csatPct: number | null;
  csatAmostra: number;
}

export interface AutomationTrendPoint {
  week: string;
  automation: number;
  kb: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PrioritySla {
  priority: string;
  count: number;
  slaCompliancePct: number;
}

export interface RequesterCount {
  name: string;
  count: number;
}