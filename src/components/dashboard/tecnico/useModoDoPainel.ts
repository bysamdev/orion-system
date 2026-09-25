import { useCallback, useState } from 'react';

export type ModoDoPainel = 'lista' | 'padrao' | 'planilha' | 'graficos';

const CHAVE = 'orion.painel.modo';
const MODOS: ModoDoPainel[] = ['lista', 'padrao', 'planilha', 'graficos'];

// Técnico abre na lista, que é onde ele trabalha; admin e developer abrem
// no quadro, com os números e a visão por situação. ('padrao' é o Quadro;
// o nome da chave ficou para não perder a escolha já salva.)
function modoInicial(role: string | null | undefined): ModoDoPainel {
  return role === 'admin' || role === 'developer' ? 'padrao' : 'lista';
}

// Modo de exibição escolhido pelo usuário, lembrado neste navegador.
export function useModoDoPainel(role: string | null | undefined) {
  const [escolhido, setEscolhido] = useState<ModoDoPainel | null>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE) as ModoDoPainel | null;
      return salvo && MODOS.includes(salvo) ? salvo : null;
    } catch {
      return null;
    }
  });

  const escolher = useCallback((modo: ModoDoPainel) => {
    setEscolhido(modo);
    try {
      localStorage.setItem(CHAVE, modo);
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): vale só nesta sessão.
    }
  }, []);

  return [escolhido ?? modoInicial(role), escolher] as const;
}
