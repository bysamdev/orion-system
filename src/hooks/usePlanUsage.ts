import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';

interface PlanUsage {
  plan_name: string;
  max_users: number;
  current_users: number;
  company_id: string;
}

export const usePlanUsage = () => {
  return useQuery({
    queryKey: ['plan-usage'],
    queryFn: async () => {
      const { data, error } = await supabaseRead.rpc('get_company_plan_usage');
      
      if (error) throw error;
      
      // Verificar se há erro na resposta
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(data.error as string);
      }
      
      return data as unknown as PlanUsage;
    },
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: true,
  });
};
