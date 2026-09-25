import type { LinhaDoInventario } from './RelatorioDeInventario';

// Planilha do inventário no formato do relatório "Dispositivo por Cliente
// Analítico" do Milvus: uma linha por dispositivo, cabeçalho fixo e com o
// filtro do Excel ligado. Com todos os clientes, vem uma aba geral, uma de
// resumo e uma por cliente; com um cliente filtrado, só a aba dele.

interface ColunaDaPlanilha {
  titulo: string;
  largura: number;
  valor: (l: LinhaDoInventario) => string | number | Date | null;
}

// A lib grava a data em UTC; o Excel não tem fuso, então desloca para o
// horário local de quem exporta (o mesmo que aparece na tela).
const data = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
};

export const COLUNAS_DA_PLANILHA: ColunaDaPlanilha[] = [
  { titulo: 'Tipo de dispositivo', largura: 18, valor: l => l.tipo },
  { titulo: 'Cliente', largura: 24, valor: l => l.cliente },
  { titulo: 'Nome do dispositivo', largura: 22, valor: l => l.maquina },
  { titulo: 'IP', largura: 16, valor: l => l.ip },
  { titulo: 'MAC address', largura: 19, valor: l => l.mac },
  { titulo: 'Sistema operacional', largura: 18, valor: l => l.sistema },
  { titulo: 'Domínio', largura: 20, valor: l => l.dominio },
  { titulo: 'Usuário logado', largura: 18, valor: l => l.usuario },
  { titulo: 'Processador', largura: 40, valor: l => l.processador },
  { titulo: 'Memória RAM total (GB)', largura: 12, valor: l => l.memoriaGb },
  { titulo: 'Armazenamento total (GB)', largura: 14, valor: l => l.discoGb },
  { titulo: 'Antivírus', largura: 22, valor: l => l.antivirus },
  { titulo: 'Versão do agente', largura: 12, valor: l => l.versaoAgente },
  { titulo: 'Situação', largura: 10, valor: l => l.situacao },
  { titulo: 'Data de atualização', largura: 17, valor: l => data(l.ultimoContato) },
  { titulo: 'Data de criação', largura: 17, valor: l => data(l.criadoEm) },
];

// Nome de aba no Excel: até 31 caracteres, sem : \ / ? * [ ] e sem repetir.
export function nomeDeAba(nome: string, usados: Set<string>): string {
  const base = (nome.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem nome').slice(0, 31);
  let candidato = base;
  for (let n = 2; usados.has(candidato.toLowerCase()); n++) {
    const sufixo = ` (${n})`;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

// Letra da coluna (0 -> A, 25 -> Z, 26 -> AA).
export function letraDaColuna(indice: number): string {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return letra;
}

// Ordem da planilha: cliente, tipo de dispositivo e nome.
export function ordenarParaPlanilha(linhas: LinhaDoInventario[]): LinhaDoInventario[] {
  const pt = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
  return [...linhas].sort((a, b) => pt(a.cliente, b.cliente) || pt(a.tipo, b.tipo) || pt(a.maquina, b.maquina));
}

const cabecalho = (titulo: string) => ({
  value: titulo, fontWeight: 'bold' as const, color: '#FFFFFF', backgroundColor: '#4338CA', wrap: true,
});

function celula(v: string | number | Date | null) {
  if (v === null || v === '') return { value: '—', type: String };
  if (v instanceof Date) return { value: v, type: Date, format: 'dd/mm/yyyy hh:mm' };
  return typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String };
}

function abaDeDispositivos(nome: string, linhas: LinhaDoInventario[]) {
  return {
    sheet: nome,
    data: [
      COLUNAS_DA_PLANILHA.map(c => cabecalho(c.titulo)),
      ...linhas.map(l => COLUNAS_DA_PLANILHA.map(c => celula(c.valor(l)))),
    ],
    columns: COLUNAS_DA_PLANILHA.map(c => ({ width: c.largura })),
    stickyRowsCount: 1,
    orientation: 'landscape' as const,
  };
}

function abaDeResumo(nome: string, linhas: LinhaDoInventario[]) {
  const porCliente = new Map<string, number[]>();
  for (const l of linhas) {
    // total, computadores, notebooks, servidores, online
    const r = porCliente.get(l.cliente) ?? [0, 0, 0, 0, 0];
    r[0]++;
    if (l.tipo === 'Computador') r[1]++;
    if (l.tipo === 'Notebook') r[2]++;
    if (l.tipo === 'Servidor') r[3]++;
    if (l.situacao === 'Online') r[4]++;
    porCliente.set(l.cliente, r);
  }
  const clientes = [...porCliente.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const totais = clientes.reduce((t, c) => t.map((v, i) => v + porCliente.get(c)![i]), [0, 0, 0, 0, 0]);
  return {
    sheet: nome,
    data: [
      ['Cliente', 'Total', 'Computadores', 'Notebooks', 'Servidores', 'Online'].map(cabecalho),
      ...clientes.map(c => [{ value: c, type: String }, ...porCliente.get(c)!.map(v => ({ value: v, type: Number }))]),
      [{ value: 'Total geral', type: String, fontWeight: 'bold' as const }, ...totais.map(v => ({ value: v, type: Number, fontWeight: 'bold' as const }))],
    ],
    columns: [30, 10, 14, 12, 12, 10].map(width => ({ width })),
    stickyRowsCount: 1,
  };
}

export interface AbaDaPlanilha {
  sheet: string;
  data: unknown[][];
  columns: { width: number }[];
  stickyRowsCount: number;
  orientation?: 'landscape';
}

export function montarAbas(linhas: LinhaDoInventario[]): AbaDaPlanilha[] {
  const ordenadas = ordenarParaPlanilha(linhas);
  const clientes = [...new Set(ordenadas.map(l => l.cliente))];
  const usados = new Set<string>();
  if (clientes.length <= 1) return [abaDeDispositivos(nomeDeAba(clientes[0] ?? 'Dispositivos', usados), ordenadas)];
  return [
    abaDeDispositivos(nomeDeAba('Todos os clientes', usados), ordenadas),
    abaDeResumo(nomeDeAba('Resumo por cliente', usados), ordenadas),
    ...clientes.map(c => abaDeDispositivos(nomeDeAba(c, usados), ordenadas.filter(l => l.cliente === c))),
  ];
}

// Liga o filtro do Excel (as setinhas do cabeçalho) nas abas de dispositivos.
// O <autoFilter> vem logo depois de <sheetData>, na ordem que o Excel exige.
export function comFiltroNoCabecalho(xml: string, colunas: number, linhas: number): string {
  if (linhas < 1 || xml.includes('<autoFilter')) return xml;
  const ref = `A1:${letraDaColuna(colunas - 1)}${linhas}`;
  return xml.replace('</sheetData>', `</sheetData><autoFilter ref="${ref}"/>`);
}

export async function exportarPlanilhaDoInventario(linhas: LinhaDoInventario[], nome: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const abas = montarAbas(linhas);
  const filtro = {
    files: {
      transform: {
        'xl/worksheets/sheet{id}.xml': {
          transform: (xml: string, opcoes: { sheet?: string }) => {
            const aba = abas.find(a => a.sheet === opcoes.sheet);
            // Só nas abas de dispositivos (as que têm as colunas do inventário).
            if (!aba || aba.columns.length !== COLUNAS_DA_PLANILHA.length) return xml;
            return comFiltroNoCabecalho(xml, COLUNAS_DA_PLANILHA.length, aba.data.length);
          },
        },
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos da lib não cobrem células com estilo + Date
  await writeXlsxFile(abas as any, { fontFamily: 'Calibri', fontSize: 11, features: [filtro as any] }).toFile(`${nome}.xlsx`);
}
