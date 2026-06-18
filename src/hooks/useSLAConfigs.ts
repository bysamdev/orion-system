import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSLAConfigs = () => {
  return useQuery({
    queryKey: ['active-sla-config'],
    queryFn: async () => {
      // Busca o SLA padrão da empresa do usuário logado.
      // A RLS garante que só registros da mesma empresa sejam retornados.
      // Usamos .order('created_at', ascending: true) para pegar o registro
      // mais antigo (geralmente o "Padrão") como referência dos dropdowns.
      const { data, error } = await supabase
        .from('sla_configs')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(); // maybeSingle não lança erro se não encontrar (ao contrário de single)

      if (error && error.code !== 'PGRST116') throw error;

      return data ?? null;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  });
};
