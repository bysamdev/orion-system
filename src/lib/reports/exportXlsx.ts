// Geração da planilha do relatório.
//
// Usa `write-excel-file` em vez do `xlsx` (SheetJS) do npm: a última versão
// publicada no registro é de 2022 e carrega CVEs abertos de prototype pollution
// e ReDoS. Como aqui só ESCREVEMOS planilha, uma lib browser-first e enxuta
// cobre o caso sem dependência vulnerável.
//
// Números saem como número (não texto) para o cliente final conseguir somar,
// filtrar e montar tabela dinâmica em cima — que é o propósito do XLSX existir
// separado do PDF.

import type { Ticket } from '@/hooks/useTickets';
import type {
  HoursByTechnician,
  MttrByCategory,
  ReportFilters,
  ReportMetrics,
  TechnicianComparison,
} from './types';

export interface XlsxPayload {
  filters: ReportFilters;
  metrics: ReportMetrics;
  tickets: Ticket[];
  porTecnico: TechnicianComparison[];
  mttrPorCategoria: MttrByCategory[];
  horasPorTecnico: HoursByTechnician[];
}

/**
 * Coluna no formato que `getSheetData` espera (API v4).
 *
 * Atenção: NÃO é o mesmo formato do modo aba-única (`{ column, type, value }`).
 * Aqui o cabeçalho é uma célula e o corpo é uma função que devolve célula. O
 * formato antigo falha em runtime com "cell is not a function".
 */
interface Coluna<T> {
  width?: number;
  header?: { value: string; fontWeight?: string; backgroundColor?: string };
  cell: (obj: T, index: number) => {
    value: string | number | Date | null;
    type?: typeof String | typeof Number | typeof Date;
    format?: string;
  };
}

const ESTILO_CABECALHO = { fontWeight: 'bold', backgroundColor: '#EFEAF4' } as const;

const cabecalho = (texto: string) => ({ value: texto, ...ESTILO_CABECALHO });
const texto = (v: string | null | undefined) => ({ value: v ?? '', type: String });
const numero = (v: number | null | undefined, format?: string) => ({
  value: v ?? null,
  type: Number,
  ...(format ? { format } : {}),
});

/** Converte ISO para Date válido, ou null — evita célula "Invalid Date". */
function paraData(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dataCell = (iso: string | null | undefined) => {
  const d = paraData(iso);
  return d ? { value: d, type: Date, format: 'dd/mm/yyyy hh:mm' } : { value: null };
};

const ROTULO_STATUS: Record<string, string> = {
  open: 'Aberto',
  'in-progress': 'Em andamento',
  'awaiting-customer': 'Aguardando cliente',
  'awaiting-third-party': 'Aguardando terceiro',
  resolved: 'Resolvido',
  closed: 'Fechado',
  reopened: 'Reaberto',
  cancelled: 'Cancelado',
};

const ROTULO_PRIORIDADE: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const ROTULO_SLA: Record<string, string> = {
  ok: 'No prazo',
  warning: 'Alerta',
  attention: 'Atenção',
  breached: 'Estourado',
};

interface LinhaResumo {
  campo: string;
  valor: string | number;
  ehNumero: boolean;
}

export async function gerarXlsx(payload: XlsxPayload): Promise<Blob> {
  // Subpath /browser: o pacote não expõe entry raiz e a variante node puxaria
  // dependências de fs que não existem no navegador.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/browser');

  const { filters: f, metrics: m } = payload;

  // ── Aba: Resumo ────────────────────────────────────────────────────────────
  const resumo: LinhaResumo[] = [
    { campo: 'Período', valor: `${f.dateFrom} a ${f.dateTo}`, ehNumero: false },
    { campo: 'Empresa', valor: f.companyName, ehNumero: false },
    { campo: 'Técnico', valor: f.technicianName, ehNumero: false },
    { campo: 'Gerado em', valor: new Date().toLocaleString('pt-BR'), ehNumero: false },
    { campo: 'Total de chamados', valor: m.total, ehNumero: true },
    { campo: 'Em aberto', valor: m.open, ehNumero: true },
    { campo: 'Resolvidos', valor: m.resolved, ehNumero: true },
    { campo: 'Fechados/cancelados', valor: m.closed, ehNumero: true },
    { campo: 'Tempo médio de resolução (h)', valor: m.avgResolutionHours, ehNumero: true },
    { campo: 'SLA no prazo', valor: m.slaOk, ehNumero: true },
    { campo: 'SLA em atenção', valor: m.slaAttention, ehNumero: true },
    { campo: 'SLA estourado', valor: m.slaBreached, ehNumero: true },
    { campo: 'SLA cumprido (%)', valor: m.slaCompliancePct, ehNumero: true },
    { campo: 'Chamados avaliados por SLA', valor: m.slaAvaliados, ehNumero: true },
  ];

  const colResumo: Coluna<LinhaResumo>[] = [
    { width: 34, header: cabecalho('Indicador'), cell: (r) => texto(r.campo) },
    {
      width: 30,
      header: cabecalho('Valor'),
      // Coluna mista: o tipo acompanha cada célula, para os indicadores
      // numéricos continuarem somáveis no Excel em vez de virarem texto.
      cell: (r) => (r.ehNumero ? numero(r.valor as number) : texto(r.valor as string)),
    },
  ];

  // ── Aba: Chamados (dados brutos) ───────────────────────────────────────────
  const colChamados: Coluna<Ticket>[] = [
    { width: 10, header: cabecalho('Número'), cell: (t) => numero(t.ticket_number) },
    { width: 48, header: cabecalho('Título'), cell: (t) => texto(t.title) },
    { width: 26, header: cabecalho('Empresa'), cell: (t) => texto(t.company_name) },
    { width: 24, header: cabecalho('Solicitante'), cell: (t) => texto(t.requester_name) },
    { width: 20, header: cabecalho('Categoria'), cell: (t) => texto(t.category) },
    {
      width: 14,
      header: cabecalho('Prioridade'),
      cell: (t) => texto(ROTULO_PRIORIDADE[t.priority] ?? t.priority),
    },
    {
      width: 20,
      header: cabecalho('Status'),
      cell: (t) => texto(ROTULO_STATUS[t.status] ?? t.status),
    },
    {
      width: 14,
      header: cabecalho('SLA'),
      cell: (t) => texto(t.sla_status ? ROTULO_SLA[t.sla_status] ?? t.sla_status : ''),
    },
    { width: 24, header: cabecalho('Técnico'), cell: (t) => texto(t.assigned_to) },
    { width: 18, header: cabecalho('Criado em'), cell: (t) => dataCell(t.created_at) },
    { width: 18, header: cabecalho('Resolvido em'), cell: (t) => dataCell(t.resolved_at) },
    {
      width: 18,
      header: cabecalho('Horas até resolução'),
      cell: (t) => {
        const ini = paraData(t.created_at);
        const fim = paraData(t.resolved_at);
        if (!ini || !fim) return { value: null };
        const h = (fim.getTime() - ini.getTime()) / 3_600_000;
        return h >= 0 ? numero(Math.round(h * 10) / 10, '0.0') : { value: null };
      },
    },
  ];

  // ── Aba: Por Técnico ───────────────────────────────────────────────────────
  const colTecnicos: Coluna<TechnicianComparison>[] = [
    { width: 28, header: cabecalho('Técnico'), cell: (r) => texto(r.name) },
    { width: 12, header: cabecalho('Volume'), cell: (r) => numero(r.volume) },
    { width: 18, header: cabecalho('SLA cumprido (%)'), cell: (r) => numero(r.slaPct) },
    // csatPct null vira célula vazia — não zero, que leria como nota péssima.
    { width: 16, header: cabecalho('Satisfação (%)'), cell: (r) => numero(r.csatPct) },
    { width: 18, header: cabecalho('Nº de avaliações'), cell: (r) => numero(r.csatAmostra) },
  ];

  // ── Aba: Por Categoria ─────────────────────────────────────────────────────
  const colCategorias: Coluna<MttrByCategory>[] = [
    { width: 30, header: cabecalho('Categoria'), cell: (r) => texto(r.name) },
    { width: 18, header: cabecalho('Tempo médio (h)'), cell: (r) => numero(r.horas, '0.0') },
    { width: 20, header: cabecalho('Chamados resolvidos'), cell: (r) => numero(r.amostra) },
  ];

  // ── Aba: Horas Lançadas ────────────────────────────────────────────────────
  const colHoras: Coluna<HoursByTechnician>[] = [
    { width: 28, header: cabecalho('Técnico'), cell: (r) => texto(r.name) },
    { width: 14, header: cabecalho('Horas totais'), cell: (r) => numero(r.totalHoras, '0.0') },
    { width: 16, header: cabecalho('Horas faturáveis'), cell: (r) => numero(r.faturaveisHoras, '0.0') },
  ];

  // Abas sem linha nenhuma são omitidas — planilha vazia só gera dúvida sobre
  // se faltou dado ou se a exportação falhou.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const abas: Array<{ sheet: string; data: any }> = [
    { sheet: 'Resumo', data: getSheetData(resumo, colResumo as never) },
    { sheet: 'Chamados', data: getSheetData(payload.tickets, colChamados as never) },
  ];
  if (payload.porTecnico.length) {
    abas.push({ sheet: 'Por Técnico', data: getSheetData(payload.porTecnico, colTecnicos as never) });
  }
  if (payload.mttrPorCategoria.length) {
    abas.push({
      sheet: 'Por Categoria',
      data: getSheetData(payload.mttrPorCategoria, colCategorias as never),
    });
  }
  if (payload.horasPorTecnico.length) {
    abas.push({ sheet: 'Horas Lançadas', data: getSheetData(payload.horasPorTecnico, colHoras as never) });
  }

  // Sem `fileName`, a variante /browser devolve { toBlob, toFile } em vez do
  // Blob direto; o download fica a cargo de quem chamou (baixarBlob), para o
  // fluxo ser idêntico ao do PDF.
  const saida = (await writeXlsxFile(abas as never)) as unknown;
  if (saida instanceof Blob) return saida;
  if (saida && typeof (saida as any).toBlob === 'function') {
    return await (saida as any).toBlob();
  }
  throw new Error('write-excel-file não retornou um Blob utilizável');
}
