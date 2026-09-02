import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContractBillingCycle {
  id: string;
  contract_id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  contracted_hours: number | null;
  consumed_hours: number;
  closed_at: string;
}

// Último ciclo fechado de cada contrato (consumido x contratado do mês mais recente).
export const useLatestContractBillingCycles = () => {
  return useQuery({
    queryKey: ['contract-billing-cycles', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_billing_cycles')
        .select('*')
        .order('period_start', { ascending: false });

      if (error) throw error;

      const latestByContract = new Map<string, ContractBillingCycle>();
      for (const cycle of (data || []) as ContractBillingCycle[]) {
        if (!latestByContract.has(cycle.contract_id)) {
          latestByContract.set(cycle.contract_id, cycle);
        }
      }
      return latestByContract;
    },
  });
};
