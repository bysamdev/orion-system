import { format } from 'date-fns';
import { COLUNAS, texto, type LinhaDoInventario } from './colunasDoInventario';

// Planilha do inventário no mesmo modelo do PDF: título, linha de resumo
// (recorte, quantidade e data) e a tabela com as mesmas colunas e textos.
// O cabeçalho da tabela fica fixo ao rolar e com o filtro do Excel ligado.

const LINHA_DO_CABECALHO = 3; // 1: título, 2: resumo, 3: cabeçalho da tabela
const LARGURAS: Partial<Record<keyof LinhaDoInventario, number>> = {
  cliente: 22, maquina: 20, tipo: 13, sistema: 14, usuario: 16, ip: 15, processador: 38,
  memoriaGb: 13, discoGb: 11, antivirus: 20, versaoAgente: 15, situacao: 10, ultimoContato: 17,
};
const NUMERICAS = new Set<keyof LinhaDoInventario>(['memoriaGb', 'discoGb']);
const BORDA = { borderColor: '#CCCCCC', borderStyle: 'thin' as const };

// Letra da coluna (0 -> A, 25 -> Z, 26 -> AA).
export function letraDaColuna(indice: number): string {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return letra;
}

export function montarLinhasDaPlanilha(linhas: LinhaDoInventario[], subtitulo: string, geradoEm = new Date()) {
  return [
    [{ value: 'Inventário de máquinas', fontWeight: 'bold' as const, fontSize: 16 }],
    [{ value: `${subtitulo} · ${linhas.length} máquina(s) · gerado em ${format(geradoEm, 'dd/MM/yyyy HH:mm')}`, color: '#555555' }],
    COLUNAS.map(c => ({ value: c.titulo, fontWeight: 'bold' as const, backgroundColor: '#EEEEEE', ...BORDA })),
    ...linhas.map(l => COLUNAS.map(c => {
      const v = l[c.chave];
      return NUMERICAS.has(c.chave) && typeof v === 'number'
        ? { value: v, type: Number, align: 'left' as const, ...BORDA }
        : { value: texto(l, c), type: String, ...BORDA };
    })),
  ];
}

// Liga o filtro do Excel no cabeçalho da tabela. O <autoFilter> vem logo
// depois de <sheetData>, na ordem que o Excel exige.
export function comFiltroNoCabecalho(xml: string, colunas: number, ultimaLinha: number): string {
  if (ultimaLinha < LINHA_DO_CABECALHO || xml.includes('<autoFilter')) return xml;
  const ref = `A${LINHA_DO_CABECALHO}:${letraDaColuna(colunas - 1)}${ultimaLinha}`;
  return xml.replace('</sheetData>', `</sheetData><autoFilter ref="${ref}"/>`);
}

export async function exportarPlanilhaDoInventario(linhas: LinhaDoInventario[], subtitulo: string, nome: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const dados = montarLinhasDaPlanilha(linhas, subtitulo);
  const filtro = {
    files: {
      transform: {
        'xl/worksheets/sheet{id}.xml': {
          transform: (xml: string) => comFiltroNoCabecalho(xml, COLUNAS.length, dados.length),
        },
      },
    },
  };
  await writeXlsxFile(dados, {
    sheet: 'Inventário',
    columns: COLUNAS.map(c => ({ width: LARGURAS[c.chave] ?? 14 })),
    stickyRowsCount: LINHA_DO_CABECALHO,
    orientation: 'landscape',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- os tipos da lib não aceitam o objeto de feature sem genéricos
  }, { fontFamily: 'Calibri', fontSize: 11, features: [filtro as any] }).toFile(`${nome}.xlsx`);
}
