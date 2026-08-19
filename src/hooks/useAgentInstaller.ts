import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

// Instalador tem ~16MB — bem mais pesado que as chamadas JSON de sempre,
// por isso um timeout próprio em vez do padrão de 15s de apiGet.
const TIMEOUT_DOWNLOAD_MS = 60_000;

/**
 * Baixa o instalador do Orion Agent já configurado com a agent_key da
 * empresa (ver handler/installer_handlers.go no backend) e dispara o
 * download no navegador.
 */
export async function baixarInstaladorDoAgente(companyId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetchWithTimeout(`${API_URL}/api/monitoring/companies/${companyId}/installer`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeoutMs: TIMEOUT_DOWNLOAD_MS,
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

  const blob = await res.blob();

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || 'OrionInstaller.exe';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
