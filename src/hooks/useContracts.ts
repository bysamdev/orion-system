import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { mapDatabaseError, logError } from '@/lib/error-handling';

export interface Contract {
  id: string;
  company_id: string;
  name: string;
  sla_config_id: string | null;
  monthly_hours: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useContracts = (companyId?: string) => {
  return useQuery({
    queryKey: ['contracts', companyId],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contract[];
    },
  });
};

export const useActiveContracts = (companyId?: string) => {
  return useQuery({
    queryKey: ['active-contracts', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};

export const useCreateContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contract: {
      company_id: string;
      name: string;
      start_date: string;
      end_date?: string | null;
      monthly_hours?: number | null;
      sla_config_id?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert(contract)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
      toast({ title: 'Contrato criado com sucesso.' });
    },
    onError: (error) => {
      logError('useCreateContract', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};

export const useUpdateContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contract> & { id: string }) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
      toast({ title: 'Contrato atualizado.' });
    },
    onError: (error) => {
      logError('useUpdateContract', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};

export const useDeleteContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['active-contracts'] });
      toast({ title: 'Contrato removido.' });
    },
    onError: (error) => {
      logError('useDeleteContract', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    },
  });
};
