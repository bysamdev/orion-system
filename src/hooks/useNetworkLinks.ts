import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

// Links de internet dos clientes (principal e redundância). Cadastro e medição
// ficam no Orion Monitor, no servidor de monitoramento; a API do Orion só
// repassa. Nada disso passa pelo Supabase.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

async function apiRequest<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    timeoutMs: 15000,
  });
  if (res.status === 204) return {} as T;
  if (!res.ok) {
    const texto = await res.text();
    let mensagem = texto || res.statusText;
    try {
      mensagem = (JSON.parse(texto) as { error?: string }).error || mensagem;
    } catch {
      // corpo não é JSON: usa o texto como veio
    }
    throw new Error(mensagem);
  }
  return res.json();
}

export type TipoDeLink = 'dedicado' | 'starlink' | 'internet';
export type PapelDoLink = 'principal' | 'backup';

// Última medição pela sonda (agente no servidor do cliente). Campos nulos =
// não dá para medir (ex.: backup parado sem rota de teste).
export interface EstadoDoLink {
  ativo: boolean | null;
  up: boolean | null;
  latencia_ms: number | null;
  jitter_ms: number | null;
  perda_pct: number | null;
  medido_em: string;
}

// Ping do servidor de monitoramento no IP público do link.
export interface PingDeFora {
  responde: boolean;
  latencia_ms: number | null;
}

interface LinkDoMonitor {
  id: string;
  company_id: string;
  cliente: string;
  nome: string;
  papel: PapelDoLink;
  tipo: TipoDeLink;
  ip_publico: string;
  alvo_teste: string;
  sonda_machine_id: string;
  criado_em: string;
  estado: EstadoDoLink | null;
  de_fora: PingDeFora | null;
}

export interface NetworkLink {
  id: string;
  name: string;
  type: TipoDeLink;
  papel: PapelDoLink;
  company_id: string | null;
  company_name: string | null;
  ip_or_host: string;
  alvo_teste: string;
  sonda_machine_id: string;
  // Resumo para listas e relatórios: sonda quando há medição, senão o ping
  // de fora; 'pending' quando ainda não há nenhum dos dois.
  status: 'online' | 'offline' | 'pending';
  latency_ms: number | null;
  last_check: string | null;
  em_uso: boolean | null;
  estado: EstadoDoLink | null;
  de_fora: PingDeFora | null;
  created_at?: string;
}

export interface SalvarLinkInput {
  id?: string;
  company_id: string;
  nome: string;
  papel: PapelDoLink;
  tipo: TipoDeLink;
  ip_publico: string;
  alvo_teste: string;
  sonda_machine_id?: string;
}

function resumir(l: LinkDoMonitor): NetworkLink {
  const sonda = l.estado;
  let status: NetworkLink['status'] = 'pending';
  if (sonda?.up != null) status = sonda.up ? 'online' : 'offline';
  else if (l.de_fora) status = l.de_fora.responde ? 'online' : 'offline';
  return {
    id: l.id,
    name: l.nome,
    type: l.tipo,
    papel: l.papel,
    company_id: l.company_id,
    company_name: l.cliente || null,
    ip_or_host: l.ip_publico,
    alvo_teste: l.alvo_teste,
    sonda_machine_id: l.sonda_machine_id,
    status,
    latency_ms: sonda?.latencia_ms ?? l.de_fora?.latencia_ms ?? null,
    last_check: sonda?.medido_em ?? null,
    em_uso: sonda?.ativo ?? null,
    estado: sonda,
    de_fora: l.de_fora,
    created_at: l.criado_em,
  };
}

export function useNetworkLinks(companyId?: string) {
  return useQuery({
    queryKey: ['networkLinks', companyId || 'all'],
    queryFn: async (): Promise<NetworkLink[]> => {
      const caminho = companyId && companyId !== 'all'
        ? `/api/monitoring/network-links?company_id=${encodeURIComponent(companyId)}`
        : '/api/monitoring/network-links';
      const resposta = await apiRequest<{ links: LinkDoMonitor[] }>(caminho);
      return (resposta.links ?? []).map(resumir);
    },
    // A sonda mede a cada 60 s e o ping de fora a cada 30 s.
    refetchInterval: 30000,
  });
}

export function useSalvarLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dados }: SalvarLinkInput) =>
      id
        ? apiRequest<LinkDoMonitor>(`/api/monitoring/network-links/${encodeURIComponent(id)}`, 'PUT', dados)
        : apiRequest<LinkDoMonitor>('/api/monitoring/network-links', 'POST', dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['networkLinks'] }),
  });
}

export function useDeleteNetworkLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/monitoring/network-links/${encodeURIComponent(id)}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['networkLinks'] }),
  });
}
