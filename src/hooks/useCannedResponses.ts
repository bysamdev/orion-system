import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  company_id: string;
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
  });
};

export const useAddCannedResponse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (response: { title: string; content: string; shortcut?: string }) => {
      // Get user's company_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError) throw profileError;

      const { data, error } = await supabase
        .from('canned_responses')
        .insert({
          ...response,
          company_id: profile.company_id,
          created_by: (await supabase.auth.getUser()).data.user?.id || '',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      toast({
        title: 'Resposta pronta criada',
        description: 'A resposta pronta foi criada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar resposta pronta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCannedResponse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      toast({
        title: 'Resposta pronta excluída',
        description: 'A resposta pronta foi excluída com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir resposta pronta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
