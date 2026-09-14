/**
 * Prepara a descrição de um chamado para virar preview de duas linhas na
 * lista.
 *
 * Medido em 2026-09-14: as 8 descrições da base são texto puro, média de 47
 * caracteres, máximo 90, nenhuma vazia e nenhuma com marcação. Ou seja, hoje
 * nada aqui teria trabalho. A função existe pelo que pode chegar depois.
 *
 * ---------------------------------------------------------------------------
 * Sobre "nunca renderizar HTML de chamado dentro de uma lista"
 *
 * Em React isso já é verdade de graça: `{texto}` escapa, e só
 * dangerouslySetInnerHTML executaria marcação. Então o risco aqui não é XSS,
 * é legibilidade -- uma descrição colada de um e-mail apareceria como
 * `<div dir="ltr">bom dia` no meio da lista. Tirar as tags é sobre o preview
 * ficar legível, e a segurança continua vindo do JSX, não daqui.
 *
 * Por isso também não se usa esta saída para nada além de exibição: ela
 * descarta conteúdo por natureza.
 */

/** Duas linhas de preview cabem folgadamente nisso, em qualquer largura. */
export const LIMITE_DO_RESUMO = 180;

const TAGS = /<[^>]*>/g;
const ESPACOS = /\s+/g;

/** As poucas entidades que aparecem quando alguém cola de um editor. */
const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function resumoDaDescricao(
  descricao: string | null | undefined,
  limite: number = LIMITE_DO_RESUMO
): string {
  if (!descricao) return '';

  let texto = descricao.replace(TAGS, ' ');

  for (const [entidade, caractere] of Object.entries(ENTIDADES)) {
    texto = texto.split(entidade).join(caractere);
  }

  // Quebras de linha viram espaço: o preview é de duas linhas, e preservar
  // as quebras originais gastaria as duas na primeira frase.
  texto = texto.replace(ESPACOS, ' ').trim();

  if (texto.length <= limite) return texto;

  // Corta na última fronteira de palavra antes do limite, para não terminar
  // no meio de uma. Se não houver espaço nenhum (uma URL gigante, um log
  // colado sem espaços), corta no limite mesmo.
  const cortado = texto.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  const base = ultimoEspaco > limite * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado;

  return `${base.replace(/[\s.,;:!?-]+$/, '')}…`;
}
