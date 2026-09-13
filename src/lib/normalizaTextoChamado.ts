/**
 * Normalização do texto que o cliente digita ao abrir chamado.
 *
 * Roda na escrita, uma vez, e não na leitura: formatar na exibição
 * reformataria a cada render e nunca corrigiria a base.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui e não no trigger validate_ticket_input
 *
 * A auditoria da fase 1 apontou o trigger como lugar natural, porque ele já
 * faz TRIM de title e description. Levantando os caminhos de escrita, mudei
 * de ideia:
 *
 *   - Só existe UM caminho humano: o formulário de NewTicket. Não há tela de
 *     edição de chamado, e nenhuma RPC grava title/description.
 *   - O outro caminho é db.AbrirChamadoAlertaServidor, no backend Go, que
 *     escreve texto de máquina ("Falha na autocura para alerta 'X'"). Passar
 *     isso pela normalização estragaria nome de alerta em CAPS em vez de
 *     melhorar coisa alguma.
 *   - A regra de CAPS depende de uma allowlist que vai crescer. Em TypeScript
 *     ela tem teste unitário rodando na CI, que é a única forma de garantir
 *     que não regride; a CI não sobe banco, então plpgsql não teria isso.
 *   - Reverter é deploy, não migration.
 *
 * O argumento de "UI é contornável", que decidiu a trava de mesclagem a favor
 * do banco, não vale aqui: isto é cosmético. Quem chamar o PostgREST direto
 * grava texto sem formatar, e o pior que acontece é um título feio.
 */

/**
 * Siglas e nomes próprios preservados na normalização de CAPS.
 *
 * A forma escrita aqui é a forma canônica: a comparação é insensível a
 * maiúsculas, e o token é reescrito exatamente como aparece nesta lista.
 * Por isso "SQL SERVER" digitado vira "SQL Server".
 *
 * Entradas com espaço são casadas antes das de palavra única.
 */
export const SIGLAS_PRESERVADAS: readonly string[] = [
  // Multi-palavra primeiro (a ordem importa na varredura)
  'SQL Server',
  // Siglas técnicas
  'ERP', 'CPU', 'RAM', 'SSD', 'HDD', 'VPN', 'LAN', 'WAN', 'DNS', 'DHCP',
  'SQL', 'API', 'RDP', 'SMTP', 'IMAP', 'POP3', 'NFE', 'NFSE', 'CNPJ', 'CPF',
  'SLA', 'RMM', 'MSP', 'TI', 'PDV', 'XML', 'PDF', 'CSV', 'USB', 'BIOS',
  'UEFI', 'AD', 'GPO', 'NAS', 'RAID', 'SSH', 'FTP', 'SSL', 'TLS',
  // Nomes de produto
  'TeamViewer', 'AnyDesk', 'Windows', 'Linux', 'Office', 'Outlook', 'Excel',
];

/** Mínimo de letras para uma palavra isolada em CAPS virar minúscula. */
const MIN_LETRAS_PARA_BAIXAR = 4;

/** Palavras consecutivas em CAPS a partir das quais a frase toda é convertida. */
const PALAVRAS_PARA_FRASE_EM_CAPS = 3;

const MARCADOR = '\u0000';

interface Protegido {
  original: string;
  /** Forma final, quando difere do original (siglas com forma canônica). */
  canonico?: string;
}

/**
 * O marcador carrega o tipo porque a contagem de "frase em CAPS" precisa
 * distinguir os dois casos: uma sigla CONTA como palavra da sequência (é o
 * que faz "PROBLEMA NO ERP" valer 3), enquanto uma URL ou trecho entre
 * crases não conta nem quebra — é conteúdo opaco no meio da frase.
 */
const TIPO_SIGLA = 's';
const TIPO_LITERAL = 'l';

/**
 * Troca por marcadores tudo que a normalização não pode tocar: trechos entre
 * crases, URLs, e-mails e as siglas da allowlist.
 */
function proteger(texto: string): { texto: string; protegidos: Protegido[] } {
  const protegidos: Protegido[] = [];
  const guarda = (original: string, tipo: string, canonico?: string) => {
    protegidos.push({ original, canonico });
    return `${MARCADOR}${tipo}${protegidos.length - 1}${MARCADOR}`;
  };

  let saida = texto;

  // 1. Crases, URLs e e-mails: preservados byte a byte.
  saida = saida.replace(/`[^`]*`/g, m => guarda(m, TIPO_LITERAL));
  // O fim da URL não pode engolir a pontuação da frase: sem o último grupo,
  // "veja https://x/AJUDA. depois" viraria uma frase só e "depois" não seria
  // capitalizado.
  saida = saida.replace(
    /\b(?:https?:\/\/|www\.)\S*[^\s.,;:!?)\]}'"]/gi,
    m => guarda(m, TIPO_LITERAL)
  );
  saida = saida.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, m => guarda(m, TIPO_LITERAL));

  // 2. Siglas da allowlist: preservadas na forma canônica. Multi-palavra
  //    primeiro, senão "SQL SERVER" casaria só o "SQL" e sobraria "SERVER".
  for (const sigla of SIGLAS_PRESERVADAS) {
    const escapada = sigla.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapada}(?![\\p{L}\\p{N}])`, 'giu');
    saida = saida.replace(re, m => guarda(m, TIPO_SIGLA, sigla));
  }

  return { texto: saida, protegidos };
}

function restaurar(texto: string, protegidos: Protegido[]): string {
  return texto.replace(
    new RegExp(`${MARCADOR}[a-z](\\d+)${MARCADOR}`, 'g'),
    (_, i) => {
      const p = protegidos[Number(i)];
      return p.canonico ?? p.original;
    }
  );
}

const ehMarcador = (palavra: string) => palavra.startsWith(MARCADOR);
const ehSigla = (palavra: string) => palavra.startsWith(MARCADOR + TIPO_SIGLA);

/** Só letras, todas maiúsculas, e pelo menos uma letra. */
function estaEmCaps(palavra: string): boolean {
  const letras = palavra.replace(/[^\p{L}]/gu, '');
  if (letras.length === 0) return false;
  return letras === letras.toUpperCase() && letras !== letras.toLowerCase();
}

const temDigito = (palavra: string) => /\p{N}/u.test(palavra);

/**
 * Baixa CAPS de palavra isolada (>= 4 letras, sem dígito) e de frase inteira
 * em CAPS (>= 3 palavras consecutivas, aí sem exigir as 4 letras).
 *
 * Siglas e URLs já viraram marcadores em proteger(), então não chegam aqui.
 */
function normalizarCaps(texto: string): string {
  const pedacos = texto.split(/(\s+)/);
  const indicesDePalavra = pedacos
    .map((p, i) => (p.trim().length > 0 ? i : -1))
    .filter(i => i >= 0);

  const emCaps = new Set<number>();
  for (const i of indicesDePalavra) {
    if (!ehMarcador(pedacos[i]) && estaEmCaps(pedacos[i]) && !temDigito(pedacos[i])) {
      emCaps.add(i);
    }
  }

  // Marca as palavras que fazem parte de uma sequência longa em CAPS. Um
  // marcador de sigla no meio não quebra a sequência ("NAO ABRE O SQL
  // SERVER" continua sendo frase em CAPS), mas também não entra nela.
  const emFraseCaps = new Set<number>();
  let corrida: number[] = [];
  let siglasNaCorrida = 0;
  const fecharCorrida = () => {
    if (corrida.length + siglasNaCorrida >= PALAVRAS_PARA_FRASE_EM_CAPS) {
      corrida.forEach(i => emFraseCaps.add(i));
    }
    corrida = [];
    siglasNaCorrida = 0;
  };
  for (const i of indicesDePalavra) {
    if (emCaps.has(i)) {
      corrida.push(i);
    } else if (ehSigla(pedacos[i])) {
      // Conta para o tamanho da sequência, mas não é baixada: já está na
      // forma canônica.
      siglasNaCorrida++;
    } else if (ehMarcador(pedacos[i])) {
      continue;
    } else {
      fecharCorrida();
    }
  }
  fecharCorrida();

  for (const i of indicesDePalavra) {
    if (!emCaps.has(i)) continue;
    const letras = pedacos[i].replace(/[^\p{L}]/gu, '').length;
    if (emFraseCaps.has(i) || letras >= MIN_LETRAS_PARA_BAIXAR) {
      pedacos[i] = pedacos[i].toLowerCase();
    }
  }

  return pedacos.join('');
}

/** Primeira letra do texto e de cada frase depois de `.`, `!` ou `?`. */
function capitalizarFrases(texto: string): string {
  return texto.replace(
    /(^|[.!?]\s+|\n\s*)(\p{L})/gu,
    (_, prefixo, letra) => prefixo + letra.toUpperCase()
  );
}

/** Remove pontuação final repetida e o ponto final solto. Mantém `?`/`!` único. */
function limparPontuacaoFinal(titulo: string): string {
  return titulo
    .replace(/([!?.])\1+$/g, '')
    .replace(/\.+$/g, '')
    .replace(/\s+$/g, '');
}

export function normalizarTituloChamado(titulo: string): string {
  if (!titulo) return titulo;

  const { texto, protegidos } = proteger(titulo);

  let saida = texto.replace(/\s+/g, ' ').trim();
  saida = normalizarCaps(saida);
  saida = capitalizarFrases(saida);
  saida = limparPontuacaoFinal(saida);

  return restaurar(saida, protegidos).trim();
}

export function normalizarDescricaoChamado(descricao: string): string {
  if (!descricao) return descricao;

  const { texto, protegidos } = proteger(descricao);

  let saida = texto
    .replace(/[^\S\n]+/g, ' ')       // espaços/tabs, sem tocar em quebra de linha
    .replace(/ *\n */g, '\n')        // espaço colado na quebra
    .replace(/\n{3,}/g, '\n\n')      // no máximo uma linha em branco
    .trim();

  saida = normalizarCaps(saida);
  saida = capitalizarFrases(saida);

  return restaurar(saida, protegidos).trim();
}
