import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

async function apiRequest<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetchWithTimeout(`${API_URL}${path}`, { ...options, timeoutMs: 15000 });
  
  if (res.status === 204) {
    return {} as T;
  }
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export interface NetworkLink {
  id: string;
  name: string;
  type: 'link_dedicado' | 'starlink' | 'roteador' | string;
  company_id: string | null;
  company_name?: string | null;
  ip_or_host: string;
  status: 'online' | 'offline' | 'pending' | string;
  latency_ms: number | null;
  last_check: string | null;
  created_at?: string;
}

export interface CreateNetworkLinkInput {
  name: string;
  type: 'link_dedicado' | 'starlink' | 'roteador' | string;
  company_id?: string | null;
  ip_or_host: string;
  status?: string;
  latency_ms?: number | null;
}

export function useNetworkLinks(companyId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('network-links-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'network_links',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['networkLinks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['networkLinks', companyId || 'all'],
    queryFn: async (): Promise<NetworkLink[]> => {
      try {
        const queryPath = companyId && companyId !== 'all' 
          ? `/api/monitoring/network-links?company_id=${encodeURIComponent(companyId)}` 
          : '/api/monitoring/network-links';
        return await apiRequest<NetworkLink[]>(queryPath);
      } catch (err) {
        console.warn('Local API /api/monitoring/network-links error, querying Supabase directly:', err);
        let query = (supabase as any)
          .from('network_links')
          .select('*, companies(name)')
          .order('created_at', { ascending: false });

        if (companyId && companyId !== 'all') {
          query = query.eq('company_id', companyId);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Error fetching network_links from Supabase:', error);
          return [];
        }

        return (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          company_id: item.company_id || null,
          company_name: item.companies?.name || item.company_name || null,
          ip_or_host: item.ip_or_host || item.ip_address || item.host || '',
          status: item.status || 'pending',
          latency_ms: item.latency_ms ?? item.latency ?? null,
          last_check: item.last_check || item.updated_at || item.created_at || null,
          created_at: item.created_at,
        }));
      }
    },
    refetchInterval: 15000,
  });
}

export function useCreateNetworkLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNetworkLinkInput): Promise<NetworkLink> => {
      try {
        return await apiRequest<NetworkLink>('/api/monitoring/network-links', 'POST', data);
      } catch (err) {
        console.warn('Local API POST /api/monitoring/network-links error, inserting into Supabase directly:', err);
        const payload = {
          name: data.name,
          type: data.type,
          company_id: data.company_id || null,
          ip_or_host: data.ip_or_host,
          status: data.status || 'pending',
          latency_ms: data.latency_ms ?? null,
          last_check: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const { data: inserted, error } = await (supabase as any)
          .from('network_links')
          .insert([payload])
          .select('*, companies(name)')
          .single();

        if (error) {
          throw new Error(error.message || 'Erro ao criar link no Supabase');
        }

        return {
          id: inserted.id,
          name: inserted.name,
          type: inserted.type,
          company_id: inserted.company_id,
          company_name: inserted.companies?.name || null,
          ip_or_host: inserted.ip_or_host,
          status: inserted.status,
          latency_ms: inserted.latency_ms,
          last_check: inserted.last_check,
          created_at: inserted.created_at,
        };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkLinks'] });
    },
  });
}

export function useDeleteNetworkLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      try {
        await apiRequest(`/api/monitoring/network-links/${id}`, 'DELETE');
      } catch (err) {
        console.warn(`Local API DELETE /api/monitoring/network-links/${id} error, deleting from Supabase directly:`, err);
        const { error } = await (supabase as any)
          .from('network_links')
          .delete()
          .eq('id', id);

        if (error) {
          throw new Error(error.message || 'Erro ao excluir link no Supabase');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkLinks'] });
    },
  });
}
