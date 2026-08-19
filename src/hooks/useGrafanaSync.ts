import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/**
 * Replica a empresa (pasta + dashboard filtrado por company_id) no Grafana —
 * ver handler/grafana_sync_handlers.go. Best-effort de propósito: o Grafana
 * é só um espelho de navegação pro admin, nunca a fonte de verdade, então
 * uma falha aqui não deve travar nem desfazer o cadastro da empresa no
 * Supabase. O caller decide o que fazer com o erro (normalmente um toast
 * discreto, não bloqueante).
 */
export async function sincronizarEmpresaComGrafana(companyId: string, name: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetchWithTimeout(`${API_URL}/api/monitoring/companies/${companyId}/grafana-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name }),
    timeoutMs: 15_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let mensagem = text || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json?.error) mensagem = json.error;
    } catch {
      // corpo não era JSON — usa o texto cru mesmo
    }
    throw new Error(mensagem);
  }
}

/** Remove a pasta/dashboard da empresa no Grafana depois que ela é apagada. */
export async function removerEmpresaDoGrafana(companyId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetchWithTimeout(`${API_URL}/api/monitoring/companies/${companyId}/grafana-sync`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeoutMs: 15_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText);
  }
}
