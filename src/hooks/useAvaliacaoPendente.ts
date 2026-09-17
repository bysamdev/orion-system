import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Avaliação pendente que bloqueia a abertura de um novo chamado.
 *
 * A regra NÃO mora mais aqui: ela é a função SQL chamado_pendente_de_avaliacao()
 * (ver 20260916230000_avaliacao_obrigatoria.sql), que também alimenta a policy
 * de INSERT em tickets. Fonte única de propósito — enquanto a regra existia em
 * TypeScript e o bloqueio real precisava existir no banco, as duas cópias das
 * mesmas cinco exclusões iam divergir com o tempo.
 *
 * A função lê auth.uid() por dentro e não aceita um id por parâmetro: com
 * parâmetro, qualquer autenticado poderia descobrir número e título do último
 * chamado encerrado de outra pessoa.
 */

export interface ChamadoPendenteDeAvaliacao {
  id: string;
  ticket_number: number;
  title: string;
  encerradoEm: string;
}

interface LinhaRpc {
  id: string;
  ticket_number: number;
  title: string;
  encerrado_em: string;
}

export const useAvaliacaoPendente = (userId?: string) => {
  return useQuery({
    queryKey: ['avaliacao-pendente', userId],
    queryFn: async (): Promise<ChamadoPendenteDeAvaliacao | null> => {
      // A RPC ainda não está no types.ts gerado.
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: LinhaRpc[] | null; error: unknown }>;
      }).rpc('chamado_pendente_de_avaliacao');

      if (error) throw error;

      const linha = data?.[0];
      if (!linha) return null;

      return {
        id: linha.id,
        ticket_number: linha.ticket_number,
        title: linha.title,
        encerradoEm: linha.encerrado_em,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
};
