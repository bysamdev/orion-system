import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MembroDaEquipe {
  id: string;
  full_name: string | null;
}

/**
 * Técnicos, gestores e desenvolvedores que podem ser responsáveis por um
 * chamado, de todas as empresas que o usuário enxerga (a RLS de profiles
 * decide quais). Diferente de useTechnicians (useAutomation.ts), que filtra
 * pela empresa do próprio usuário e deixava de fora quem atende a partir de
 * outra empresa, como a equipe da empresa-mãe.
 */
export const useEquipeInterna = (habilitado = true) =>
  useQuery<MembroDaEquipe[]>({
    queryKey: ['equipe-interna'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_roles!inner(role)')
        .in('user_roles.role', ['technician', 'admin', 'developer'])
        .order('full_name');
      if (error) throw error;
      const vistos = new Set<string>();
      return ((data as { id: string; full_name: string | null }[]) || [])
        .filter(p => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
        .map(p => ({ id: p.id, full_name: p.full_name }));
    },
    enabled: habilitado,
    staleTime: 5 * 60_000,
  });
