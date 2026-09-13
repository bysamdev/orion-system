import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  selecionarChamadoPendente,
  type ChamadoPendenteDeAvaliacao,
  type LinhaChamado,
} from '@/lib/avaliacaoPendente';

export { JANELA_AVALIACAO_DIAS, selecionarChamadoPendente } from '@/lib/avaliacaoPendente';
export type { ChamadoPendenteDeAvaliacao } from '@/lib/avaliacaoPendente';

export const useAvaliacaoPendente = (userId?: string) => {
  return useQuery({
    queryKey: ['avaliacao-pendente', userId],
    queryFn: async (): Promise<ChamadoPendenteDeAvaliacao | null> => {
      // ticket_ratings não está no types.ts gerado, então o embed é tipado
      // aqui em vez de vir do schema.
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, status, closed_at, resolved_at, metadata, ticket_ratings(id)')
        .eq('user_id', userId!)
        .in('status', ['resolved', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(10)
        .returns<LinhaChamado[]>();

      if (error) throw error;
      return selecionarChamadoPendente(data ?? []);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
};
