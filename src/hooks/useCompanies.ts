import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';

export interface CompanyOption {
  id: string;
  name: string;
  is_vip: boolean;
}

// Fonte única para a lista de empresas usada em selects/admin. Antes
// disparada com 6 chaves de cache diferentes ('companies',
// 'all-companies', 'companies-list', 'admin-companies') espalhadas por
// Assets.tsx, UserManagement.tsx, CompanyManagement.tsx,
// ContractManagement.tsx, Reports.tsx, RoutingRulesManagement.tsx e
// useAutomation.ts — cada uma refazendo o mesmo SELECT sem compartilhar
// cache entre si. Uma delas (useAllCompanies, em useAutomation.ts)
// ainda pedia uma coluna `is_vip` que não existe em `companies` (o
// campo é derivado de `settings->>'is_vip'`, como já feito em
// NewTicket.tsx) — o erro do Postgrest era engolido silenciosamente
// porque a query não checava `error`, então a lista de empresas VIP
// nunca funcionou de fato ali.
// Chave própria ('company-options'), distinta de ['companies'] --
// CompanyManagement.tsx já usa essa chave pro registro COMPLETO
// (select('*'), usado no CRUD de empresas); usar a mesma aqui colidiria
// duas formas diferentes de cache sob a mesma chave.
export const useCompanies = () => {
  return useQuery({
    queryKey: ['company-options'],
    queryFn: async (): Promise<CompanyOption[]> => {
      const { data, error } = await supabaseRead
        .from('companies')
        .select('id, name, settings')
        .order('name');
      if (error) throw error;

      return (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        is_vip: (c.settings as Record<string, unknown> | null)?.is_vip === true,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
};
