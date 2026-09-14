/**
 * Vocabulário de `tickets.remote_tool`.
 *
 * Os valores são minúsculos porque o CHECK tickets_remote_tool_valid é
 * sensível a caixa: gravar 'TeamViewer' devolve 23514. Medido ao aplicar a
 * migration 20260914120000. O rótulo bonito mora aqui, não no banco.
 *
 * NULL não é um estado de erro — é o estado de todo chamado aberto antes de
 * 2026-09-14, e de qualquer chamado sem acesso remoto.
 */

export type FerramentaRemota = 'teamviewer' | 'anydesk';

interface DescricaoDeFerramenta {
  valor: FerramentaRemota;
  rotulo: string;
  /** Rótulo do campo de ID quando esta ferramenta está escolhida. */
  rotuloDoId: string;
  placeholder: string;
  /** Cor da marca — bolinha do rádio e realce do chip, com e sem seleção. */
  corPonto: string;
  corSelecionada: string;
  corNaoSelecionada: string;
}

export const FERRAMENTAS_REMOTAS: DescricaoDeFerramenta[] = [
  {
    valor: 'teamviewer',
    rotulo: 'TeamViewer',
    rotuloDoId: 'ID TeamViewer',
    placeholder: 'Ex: 123 456 789',
    // Azul da marca TeamViewer.
    corPonto: 'accent-sky-500',
    corSelecionada: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    corNaoSelecionada: 'border-sky-500/30 bg-background text-sky-700 dark:text-sky-400 hover:bg-sky-500/5',
  },
  {
    valor: 'anydesk',
    rotulo: 'AnyDesk',
    rotuloDoId: 'Endereço AnyDesk',
    placeholder: 'Ex: 123 456 789',
    // Vermelho da marca AnyDesk.
    corPonto: 'accent-red-500',
    corSelecionada: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
    corNaoSelecionada: 'border-red-500/30 bg-background text-red-700 dark:text-red-400 hover:bg-red-500/5',
  },
];

const POR_VALOR = new Map(FERRAMENTAS_REMOTAS.map((f) => [f.valor, f]));

/** Rótulo de exibição. Aceita o que vier do banco, inclusive NULL e lixo. */
export function rotuloDaFerramentaRemota(valor: string | null | undefined): string {
  if (!valor) return 'Ferramenta não informada';
  return POR_VALOR.get(valor as FerramentaRemota)?.rotulo ?? valor;
}

/**
 * Rótulo e placeholder do campo de ID. Sem ferramenta escolhida o campo
 * continua utilizável, com texto neutro — o bloco inteiro é opcional.
 */
export function campoDeIdRemoto(valor: FerramentaRemota | null): {
  rotulo: string;
  placeholder: string;
} {
  const ferramenta = valor ? POR_VALOR.get(valor) : undefined;
  return {
    rotulo: ferramenta?.rotuloDoId ?? 'ID de acesso remoto',
    placeholder: ferramenta?.placeholder ?? 'ID do TeamViewer ou endereço do AnyDesk',
  };
}
