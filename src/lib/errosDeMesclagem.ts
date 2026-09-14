/**
 * Traduz os ERRCODEs que fn_merge_tickets levanta.
 *
 * A função de banco define códigos próprios (ver
 * 20260913100000_conserta_merge_de_chamados.sql) justamente para o front
 * poder distinguir "a regra recusou" de "algo quebrou". Sem esta tradução o
 * usuário recebe o texto cru do Postgres, que vem em inglês e menciona
 * nomes de coluna.
 *
 * Com o seletor de chamados, ORI12 e ORI13 deixam de ser alcançáveis pelo
 * caminho normal: a lista só oferece chamados do mesmo solicitante e da
 * mesma empresa. Continuam mapeados porque a checagem é do banco, não da
 * tela — entre abrir o diálogo e confirmar, outra pessoa pode ter mexido no
 * chamado. É o mesmo motivo de a validação viver no banco: a UI é
 * contornável, e aqui ela também é apenas uma fotografia.
 */

export const MENSAGENS_DE_MESCLAGEM: Record<string, string> = {
  ORI10: 'O chamado principal não pode ser mesclado a si mesmo.',
  ORI11: 'Um dos chamados selecionados não existe mais. Recarregue a página.',
  ORI12: 'Os chamados são de solicitantes diferentes e não podem ser mesclados.',
  ORI13: 'Os chamados são de empresas diferentes e não podem ser mesclados.',
  '42501': 'Você não tem permissão para mesclar estes chamados.',
  '28000': 'Sua sessão expirou. Entre novamente para mesclar chamados.',
};

const FALLBACK = 'Não foi possível mesclar os chamados.';

/**
 * `code` é o campo que o PostgREST devolve em erros de RPC. Quando vem vazio
 * (erro de rede, por exemplo) sobra a mensagem original, que é melhor que um
 * texto genérico por esconder menos.
 */
export function mensagemDeErroDeMesclagem(erro: unknown): string {
  if (!erro || typeof erro !== 'object') return FALLBACK;

  const { code, message } = erro as { code?: unknown; message?: unknown };

  if (typeof code === 'string' && code in MENSAGENS_DE_MESCLAGEM) {
    return MENSAGENS_DE_MESCLAGEM[code];
  }

  return typeof message === 'string' && message.trim() ? message : FALLBACK;
}
