/**
 * Agrupamento da lista de usuários por empresa, usado pelo menu de usuários
 * (src/components/admin/UserManagement.tsx).
 *
 * Mora aqui, e não dentro do componente, porque é regra de apresentação com
 * decisões que precisam de teste: a ordem das empresas, o balde "Sem empresa"
 * e a contagem de quem é equipe interna. Mesmo caminho de avaliacaoPendente.ts
 * e ferramentaRemota.ts.
 */

/** Papéis globais: enxergam todas as empresas, não só a própria. */
const PAPEIS_DE_EQUIPE = new Set(['admin', 'technician', 'developer']);

export interface UsuarioAgrupavel {
  role: string;
  company_name: string;
}

export interface GrupoDeEmpresa<T extends UsuarioAgrupavel> {
  empresa: string;
  usuarios: T[];
  /** Quantos, dentro do grupo, são equipe interna. */
  equipe: number;
}

export const SEM_EMPRESA = 'Sem empresa';

/**
 * Agrupa por empresa, em ordem alfabética (pt-BR, para acento não jogar
 * "Ática" para o fim da lista), com "Sem empresa" sempre por último — é o
 * balde de perfis órfãos, incluindo contas-fantasma de máquina, não uma
 * empresa de verdade.
 *
 * A ordem dos usuários dentro de cada grupo é preservada como veio: quem
 * chama já decidiu isso na consulta.
 */
export function agruparUsuariosPorEmpresa<T extends UsuarioAgrupavel>(
  usuarios: T[] | undefined | null
): GrupoDeEmpresa<T>[] {
  if (!usuarios || usuarios.length === 0) return [];

  const grupos = new Map<string, T[]>();
  for (const usuario of usuarios) {
    const empresa = usuario.company_name || SEM_EMPRESA;
    const atual = grupos.get(empresa);
    if (atual) atual.push(usuario);
    else grupos.set(empresa, [usuario]);
  }

  return [...grupos.entries()]
    .map(([empresa, lista]) => ({
      empresa,
      usuarios: lista,
      equipe: lista.filter((u) => PAPEIS_DE_EQUIPE.has(u.role)).length,
    }))
    .sort((a, b) => {
      if (a.empresa === SEM_EMPRESA) return 1;
      if (b.empresa === SEM_EMPRESA) return -1;
      return a.empresa.localeCompare(b.empresa, 'pt-BR');
    });
}
