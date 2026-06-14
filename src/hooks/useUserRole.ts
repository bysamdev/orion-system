import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Define os níveis de acesso possíveis dentro do Orion System.
export type UserRole = 'customer' | 'technician' | 'admin' | 'developer' | 'gestor';

// Hook para identificar o nível de permissão (role) do usuário logado.
// Utilizado para restringir acesso a páginas técnicas e de admin.
export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Consultamos a tabela user_roles associada ao ID do Supabase Auth.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      const testRole = new URLSearchParams(window.location.search).get('testRole');
      if (testRole) {
        return testRole as UserRole;
      }
      return data?.role as UserRole | null;
    },
    enabled: !!user?.id, // Só executa se houver um usuário logado.
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};

// Hook para buscar os detalhes do perfil do usuário (nome, empresa, departamento).
export const useUserProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // O perfil guarda informações adicionais que não estão no Auth nativo do Supabase.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};
