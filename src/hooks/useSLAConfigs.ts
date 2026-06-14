import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSLAConfigs = () => {
  return useQuery({
    queryKey: ['active-sla-config'],
    queryFn: async () => {
      // For now, fetch the first available SLA config globally, 
      // as multi-tenant SLA enforcement per user isn't strictly mapping yet for the dropdowns.
      const { data, error } = await supabase
        .from('sla_configs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; // ignore row not found
      
      // Return the data fetched from the database, no hardcoded fallbacks
      return data;
    }
  });
};
