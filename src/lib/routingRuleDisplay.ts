// Resolve o UUID interno de uma regra de roteamento (técnico atribuído,
// empresa da condição) pro nome legível — usado em RoutingRulesManagement,
// que antes mostrava o UUID bruto na coluna "Ação". O UUID continua sendo o
// valor real gravado em conditions.value/actions.target; isto só decide o
// que aparece na tela.

export function resolverNomeExibicao(
  id: string | undefined,
  carregando: boolean,
  nomesPorId: Map<string, string | null | undefined>,
  fallback: string
): string {
  if (carregando) return '…';
  if (!id) return fallback;
  return nomesPorId.get(id) || fallback;
}
