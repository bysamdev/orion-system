// Geração do PDF do relatório.
//
// Os gráficos entram como VETOR, não como bitmap: o Recharts (e os nossos
// Bullet/Gauge) desenham SVG real no DOM, então basta clonar esse nó e passá-lo
// ao svg2pdf. O texto continua selecionável e o traço não serrilha em zoom —
// que era o defeito da abordagem html2canvas.
//
// jspdf, svg2pdf.js e este módulo são carregados sob demanda (import dinâmico)
// para não pesarem no bundle inicial da página.

import type { Ticket } from '@/hooks/useTickets';
import type { BulletKpi, ReportFilters, ReportMetrics, ReportMode, SlaTarget } from './types';

export interface PdfPayload {
  mode: ReportMode;
  filters: ReportFilters;
  metrics: ReportMetrics;
  slaTarget: SlaTarget | null;
  bulletKpis: BulletKpi[];
  tickets: Ticket[];
  /** Containers marcados com data-report-chart, em ordem de documento. */
  chartNodes: HTMLElement[];
}

// A4 retrato, em milímetros.
const PAG_L = 210;
const PAG_A = 297;
const MARGEM = 14;
const UTIL = PAG_L - MARGEM * 2;

/**
 * Propriedades de pintura que precisam virar valor absoluto.
 *
 * Os gráficos usam `hsl(var(--primary))` e classes utilitárias do Tailwind.
 * Num SVG destacado do documento, `var()` não resolve e a classe não se aplica —
 * o resultado seria um PDF preto ou vazio. getComputedStyle no nó ORIGINAL
 * devolve o valor já resolvido, que copiamos para o clone.
 */
const PROPS_PINTURA = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-size',
  'font-weight',
  'font-family',
  'text-anchor',
] as const;

function inlineEstilosComputados(original: SVGSVGElement, clone: SVGSVGElement) {
  const origem = [original, ...Array.from(original.querySelectorAll<SVGElement>('*'))];
  const destino = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))];

  for (let i = 0; i < origem.length && i < destino.length; i++) {
    const computado = window.getComputedStyle(origem[i]);
    const alvo = destino[i];
    for (const prop of PROPS_PINTURA) {
      const valor = computado.getPropertyValue(prop);
      if (valor && valor !== 'none' && valor !== 'normal') {
        alvo.style.setProperty(prop, valor);
      }
    }
    // Classe já foi traduzida em estilo inline acima; mantê-la só confundiria.
    alvo.removeAttribute('class');
  }
}

/** Devolve o cabeçalho textual do card que envolve o gráfico. */
function tituloDoGrafico(container: HTMLElement, indice: number): string {
  const rotulo = container.getAttribute('data-report-chart-title');
  if (rotulo) return rotulo;
  return `Gráfico ${indice + 1}`;
}

/** Cede o controle ao browser para o spinner conseguir pintar entre etapas. */
const respira = () => new Promise((r) => setTimeout(r, 0));

const dataHoraBR = () =>
  new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export async function gerarPdf(payload: PdfPayload): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGEM;

  const novaPagina = () => {
    doc.addPage();
    y = MARGEM;
  };

  const garantirEspaco = (altura: number) => {
    if (y + altura > PAG_A - MARGEM) novaPagina();
  };

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório Gerencial de Chamados', MARGEM, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const modoLabel = payload.mode === 'resumido' ? 'Resumido (executivo)' : 'Detalhado';
  const linhasCabecalho = [
    `Modo: ${modoLabel}`,
    `Período: ${payload.filters.dateFrom} a ${payload.filters.dateTo}`,
    `Empresa: ${payload.filters.companyName}`,
    `Técnico: ${payload.filters.technicianName}`,
    `Gerado em: ${dataHoraBR()}`,
  ];
  if (payload.slaTarget) {
    linhasCabecalho.push(`Meta de SLA: ${payload.slaTarget.sourceName}`);
  }
  for (const linha of linhasCabecalho) {
    doc.text(linha, MARGEM, y);
    y += 4;
  }
  doc.setTextColor(0);
  y += 2;
  doc.setDrawColor(200);
  doc.line(MARGEM, y, PAG_L - MARGEM, y);
  y += 7;

  // ── Indicadores ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Indicadores do período', MARGEM, y);
  y += 6;

  const m = payload.metrics;
  const kpis: Array<[string, string]> = [
    ['Total de chamados', String(m.total)],
    ['Em aberto', String(m.open)],
    ['Resolvidos/fechados', String(m.resolved + m.closed)],
    ['Tempo médio de resolução', `${m.avgResolutionHours}h`],
    ['SLA cumprido', `${m.slaCompliancePct}% (${m.slaOk}/${m.slaAvaliados})`],
    ['SLA estourado', String(m.slaBreached)],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const colL = UTIL / 3;
  kpis.forEach(([rotulo, valor], i) => {
    const col = i % 3;
    const linha = Math.floor(i / 3);
    const x = MARGEM + col * colL;
    const yy = y + linha * 12;
    doc.setTextColor(110);
    doc.text(rotulo, x, yy);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(valor, x, yy + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
  });
  y += Math.ceil(kpis.length / 3) * 12 + 4;

  // ── Metas contratuais (bullets) ────────────────────────────────────────────
  if (payload.bulletKpis.length > 0) {
    garantirEspaco(10 + payload.bulletKpis.length * 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Tempo de resolução vs. meta contratual', MARGEM, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const k of payload.bulletKpis) {
      const ok = k.betterWhen === 'lower' ? k.value <= k.target : k.value >= k.target;
      doc.setTextColor(110);
      doc.text(`${k.label}`, MARGEM, y);
      doc.setTextColor(0);
      doc.text(
        `${k.value}${k.unit}  /  meta ${k.target}${k.unit}   ${ok ? '(dentro)' : '(fora)'}   base ${k.sampleSize}`,
        MARGEM + 45,
        y,
      );
      y += 5;
    }
    y += 3;
  }

  // ── Gráficos, em vetor ─────────────────────────────────────────────────────
  for (let i = 0; i < payload.chartNodes.length; i++) {
    const container = payload.chartNodes[i];
    const svgOriginal = container.querySelector('svg');
    if (!svgOriginal) continue;

    await respira();

    const larguraSvg = svgOriginal.clientWidth || svgOriginal.viewBox?.baseVal?.width || 600;
    const alturaSvg = svgOriginal.clientHeight || svgOriginal.viewBox?.baseVal?.height || 300;
    if (!larguraSvg || !alturaSvg) continue;

    const alturaMm = Math.min((UTIL * alturaSvg) / larguraSvg, 110);
    garantirEspaco(alturaMm + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(tituloDoGrafico(container, i), MARGEM, y);
    y += 4;

    const clone = svgOriginal.cloneNode(true) as SVGSVGElement;
    inlineEstilosComputados(svgOriginal, clone);
    clone.setAttribute('width', String(larguraSvg));
    clone.setAttribute('height', String(alturaSvg));

    // svg2pdf exige o nó anexado ao documento para medir texto; mantemos fora
    // da viewport para não causar salto visual na página.
    const palco = document.createElement('div');
    palco.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none';
    palco.appendChild(clone);
    document.body.appendChild(palco);

    try {
      await svg2pdf(clone, doc, { x: MARGEM, y, width: UTIL, height: alturaMm });
      y += alturaMm + 8;
    } catch {
      // Um gráfico problemático não pode abortar o relatório inteiro.
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('(gráfico não pôde ser renderizado)', MARGEM, y + 4);
      doc.setTextColor(0);
      y += 10;
    } finally {
      palco.remove();
    }
  }

  // ── Tabela de dados (apenas no detalhado) ──────────────────────────────────
  if (payload.mode === 'detalhado' && payload.tickets.length > 0) {
    await respira();
    novaPagina();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Dados analíticos — ${payload.tickets.length} chamados`, MARGEM, y);
    y += 6;

    const colunas: Array<{ titulo: string; largura: number; valor: (t: Ticket) => string }> = [
      { titulo: '#', largura: 12, valor: (t) => String(t.ticket_number) },
      { titulo: 'Título', largura: 52, valor: (t) => t.title },
      { titulo: 'Empresa', largura: 32, valor: (t) => t.company_name ?? '—' },
      { titulo: 'Prior.', largura: 16, valor: (t) => t.priority },
      { titulo: 'Status', largura: 24, valor: (t) => t.status },
      { titulo: 'SLA', largura: 16, valor: (t) => t.sla_status ?? '—' },
      { titulo: 'Técnico', largura: 30, valor: (t) => t.assigned_to ?? '—' },
    ];

    const desenhaCabecalhoTabela = () => {
      doc.setFillColor(240, 240, 240);
      doc.rect(MARGEM, y - 4, UTIL, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let x = MARGEM + 1;
      for (const c of colunas) {
        doc.text(c.titulo, x, y);
        x += c.largura;
      }
      y += 5;
      doc.setFont('helvetica', 'normal');
    };

    desenhaCabecalhoTabela();
    doc.setFontSize(7);

    for (const t of payload.tickets) {
      if (y > PAG_A - MARGEM - 6) {
        novaPagina();
        desenhaCabecalhoTabela();
        doc.setFontSize(7);
      }
      let x = MARGEM + 1;
      for (const c of colunas) {
        // Trunca no limite da coluna para não invadir a vizinha.
        const texto = doc.splitTextToSize(c.valor(t) || '—', c.largura - 2)[0] ?? '';
        doc.text(texto, x, y);
        x += c.largura;
      }
      y += 4.2;
    }
  }

  // ── Rodapé com paginação ───────────────────────────────────────────────────
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text('Orion System', MARGEM, PAG_A - 8);
    doc.text(`Página ${p} de ${totalPaginas}`, PAG_L - MARGEM, PAG_A - 8, { align: 'right' });
  }

  return doc.output('blob');
}

export function nomeArquivo(mode: ReportMode, f: ReportFilters, ext: string) {
  return `relatorio_${mode}_${f.dateFrom}_a_${f.dateTo}.${ext}`;
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoga só depois do clique ser processado, senão o download aborta no Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
