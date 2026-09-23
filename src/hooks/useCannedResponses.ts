import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  company_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useCannedResponses = () => {
  return useQuery({
    queryKey: ['canned-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .order('title');

      if (error) throw error;
      return data as CannedResponse[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};
