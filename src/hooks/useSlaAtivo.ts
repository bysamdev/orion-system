import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Liga/desliga do SLA do sistema inteiro (migration 20260922030000). Sem a
// linha, vale ligado, igual à função sla_ativo() do banco.
const CHAVE = ['sla-ativo'];

// A tabela e a função ainda não estão nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const useSlaAtivo = () =>
  useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await db
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'sla_ativo')
        .maybeSingle();
      if (error) throw error;
      return data?.valor !== false;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useDefinirSlaAtivo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await db.rpc('definir_sla_ativo', { p_ativo: ativo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};
