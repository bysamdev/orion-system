import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompanyOption {
  id: string;
  name: string;
  is_vip: boolean;
  has_contract: boolean;
}

// Fonte única para a lista de empresas usada em selects/admin.
export const useCompanies = () => {
  return useQuery({
    queryKey: ['company-options'],
    queryFn: async (): Promise<CompanyOption[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, settings, has_contract')
        .order('name');
      if (error) throw error;

      return (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        is_vip: (c.settings as Record<string, unknown> | null)?.is_vip === true,
        has_contract: c.has_contract !== false,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
};
