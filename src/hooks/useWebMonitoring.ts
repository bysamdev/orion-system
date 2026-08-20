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

export interface MonitoredEndpoint {
  id: string;
  name: string;
  url_or_ip: string;
  uptimerobot_monitor_id: string;
  status: string; // "pending", "online", "offline", "paused"
}

export function useWebEndpoints() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = `monitored-endpoints-realtime-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitored_endpoints',
        },
        () => {
          try {
            queryClient.invalidateQueries({ queryKey: ['webEndpoints'] });
          } catch (e) {
            console.warn('[useWebEndpoints] Erro ao invalidar webEndpoints:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useWebEndpoints] Erro no canal realtime webEndpoints');
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn('[useWebEndpoints] Erro ao remover canal realtime:', err);
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['webEndpoints'],
    queryFn: async () => {
      try {
        return await apiRequest<MonitoredEndpoint[]>('/api/monitoring/web/endpoints');
      } catch (err) {
        console.warn('API endpoint fetch failed, falling back to Supabase:', err);
        const { data, error } = await (supabase as any)
          .from('monitored_endpoints')
          .select('id, name, url_or_ip, uptimerobot_monitor_id, status')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          url_or_ip: item.url_or_ip,
          uptimerobot_monitor_id: item.uptimerobot_monitor_id || '',
          status: item.status || 'pending',
        }));
      }
    },
    refetchInterval: 15000, // 15s cadência do Prometheus
  });
}

export function useCreateWebEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; url: string }) => {
      try {
        return await apiRequest<{ success: boolean; monitor_id: string }>('/api/monitoring/web/endpoints', 'POST', data);
      } catch (err: any) {
        console.warn('API endpoint creation failed, falling back to direct Supabase insert:', err);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Não autenticado');

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', userData.user.id)
          .maybeSingle();

        const companyId = profile?.company_id;
        if (!companyId) throw new Error('Empresa do usuário não encontrada');

        const { data: inserted, error } = await (supabase as any)
          .from('monitored_endpoints')
          .insert({
            company_id: companyId,
            name: data.name,
            url_or_ip: data.url,
            status: 'online',
          })
          .select('id')
          .single();

        if (error) throw error;
        return { success: true, monitor_id: inserted.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webEndpoints'] });
    },
  });
}

export function useDeleteWebEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await apiRequest(`/api/monitoring/web/endpoints/${id}`, 'DELETE');
      } catch (err) {
        console.warn('API endpoint delete failed, falling back to direct Supabase delete:', err);
        const { error } = await (supabase as any)
          .from('monitored_endpoints')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webEndpoints'] });
    },
  });
}

export * from './useNetworkLinks';
