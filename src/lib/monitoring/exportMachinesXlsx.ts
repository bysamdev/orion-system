// Exportação da lista de máquinas do Monitoramento (/sistemas) pra
// planilha — mesmo padrão de src/lib/reports/exportXlsx.ts (write-excel-file,
// não SheetJS: só escrevemos, e a última versão publicada do xlsx no npm
// carrega CVEs abertos de prototype pollution/ReDoS).
//
// Ordenação alfabética fica por conta de quem abre a planilha (Excel/
// Google Sheets já ordenam nativamente) — só exportamos os dados brutos.

import type { MachineWithMetric } from '@/hooks/useMonitoring';
import { pct } from '@/hooks/useMonitoring';

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
const numero = (v: number | null | undefined) => ({ value: v ?? null, type: Number });

const ROTULO_STATUS: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  alerta: 'Alerta',
};

function bytesParaGB(bytes: number | null | undefined): number | null {
  if (bytes == null || Number.isNaN(bytes)) return null;
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

function dataCell(iso: string | null | undefined) {
  if (!iso) return { value: null };
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? { value: null } : { value: d, type: Date, format: 'dd/mm/yyyy hh:mm' };
}

export interface MachineExportRow extends MachineWithMetric {
  company_name: string;
}

export async function gerarMachinesXlsx(machines: MachineExportRow[]): Promise<Blob> {
  // Subpath /browser: igual exportXlsx.ts — a variante node puxaria fs, que
  // não existe no navegador.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/browser');

  const colunas: Coluna<MachineExportRow>[] = [
    { width: 26, header: cabecalho('Hostname'), cell: (m) => texto(m.hostname) },
    { width: 26, header: cabecalho('Empresa'), cell: (m) => texto(m.company_name) },
    { width: 18, header: cabecalho('Domínio'), cell: (m) => texto(m.domain) },
    { width: 16, header: cabecalho('IP'), cell: (m) => texto(m.ip_address) },
    { width: 18, header: cabecalho('MAC'), cell: (m) => texto(m.mac_address) },
    { width: 22, header: cabecalho('Usuário Atual'), cell: (m) => texto(m.current_user) },
    { width: 26, header: cabecalho('Sistema Operacional'), cell: (m) => texto([m.os, m.os_version].filter(Boolean).join(' ')) },
    { width: 14, header: cabecalho('Status'), cell: (m) => texto(ROTULO_STATUS[m.status] ?? m.status) },
    { width: 12, header: cabecalho('CPU (%)'), cell: (m) => numero(m.cpu_usage != null ? Math.round(m.cpu_usage) : null) },
    { width: 14, header: cabecalho('RAM usada (GB)'), cell: (m) => numero(bytesParaGB(m.ram_used)) },
    { width: 14, header: cabecalho('RAM total (GB)'), cell: (m) => numero(bytesParaGB(m.ram_total)) },
    { width: 16, header: cabecalho('Disco usado (GB)'), cell: (m) => numero(bytesParaGB(m.disk_used)) },
    { width: 16, header: cabecalho('Disco total (GB)'), cell: (m) => numero(bytesParaGB(m.disk_total)) },
    { width: 12, header: cabecalho('Disco (%)'), cell: (m) => numero(pct(m.disk_used, m.disk_total)) },
    { width: 14, header: cabecalho('Versão Agente'), cell: (m) => texto(m.agent_version) },
    { width: 18, header: cabecalho('Última atividade'), cell: (m) => dataCell(m.last_seen) },
  ];

  const dados = getSheetData(machines, colunas as never);
  const saida = (await writeXlsxFile([{ sheet: 'Máquinas', data: dados }] as never)) as unknown;
  if (saida instanceof Blob) return saida;
  if (saida && typeof (saida as any).toBlob === 'function') {
    return await (saida as any).toBlob();
  }
  throw new Error('write-excel-file não retornou um Blob utilizável');
}

export function nomeArquivoMachines(): string {
  const agora = new Date().toISOString().slice(0, 10);
  return `maquinas_orion_${agora}.xlsx`;
}
