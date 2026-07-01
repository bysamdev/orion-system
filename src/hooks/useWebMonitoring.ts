import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

  const res = await fetch(`${API_URL}${path}`, options);
  
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
  return useQuery({
    queryKey: ['webEndpoints'],
    queryFn: () => apiRequest<MonitoredEndpoint[]>('/api/monitoring/web/endpoints'),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useCreateWebEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; url: string }) => 
      apiRequest<{ success: boolean; monitor_id: string }>('/api/monitoring/web/endpoints', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webEndpoints'] });
    },
  });
}

export function useDeleteWebEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/monitoring/web/endpoints/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webEndpoints'] });
    },
  });
}
