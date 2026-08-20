import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  UserProfileSummary,
  ProfilesMap,
  ResolveUserOptions,
  resolveUserDisplayName,
  replaceUserUuidsInText,
  createProfilesMap,
  isUuid,
  isSystemUser,
} from '@/lib/userDisplayName';

export * from '@/lib/userDisplayName';

/**
 * Hook centralizado que busca todos os perfis de usuários com suas funções (roles)
 * e armazena em cache no React Query por 5 minutos (gcTime: 15min).
 * Retorna tanto a lista de perfis quanto um Map indexado pelo ID do usuário.
 */
export const useProfilesMap = () => {
  const query = useQuery({
    queryKey: ['all-profiles-map'],
    queryFn: async (): Promise<UserProfileSummary[]> => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, company_id');

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      // Opcionalmente busca roles associadas
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

      return profiles.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        department: p.department,
        company_id: p.company_id,
        role: roleMap.get(p.id) || null,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache fresco
    gcTime: 15 * 60 * 1000,    // 15 minutos em memória
  });

  const profilesMap = useMemo(() => {
    return createProfilesMap(query.data);
  }, [query.data]);

  return {
    profiles: query.data || [],
    profilesMap,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook para resolver o nome legível de um único usuário/técnico pelo ID.
 */
export const useUserDisplayName = (
  userId: string | null | undefined,
  optionsOrFallback?: ResolveUserOptions | string
) => {
  const { profilesMap, isLoading } = useProfilesMap();

  const options: ResolveUserOptions = useMemo(() => {
    if (typeof optionsOrFallback === 'string') {
      return { fallback: optionsOrFallback, isLoading };
    }
    return { ...optionsOrFallback, isLoading };
  }, [optionsOrFallback, isLoading]);

  const displayName = useMemo(() => {
    return resolveUserDisplayName(userId, profilesMap, options);
  }, [userId, profilesMap, options]);

  return {
    displayName,
    isLoading,
    profilesMap,
  };
};

/**
 * Alias para useProfilesMap
 */
export const useUserProfiles = useProfilesMap;
