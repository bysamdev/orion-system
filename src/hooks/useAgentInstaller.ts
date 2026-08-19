import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

// Montar o instalador (assinar chave, subir pro Storage) é mais lento que
// as chamadas JSON de sempre, por isso um timeout próprio em vez do padrão
// de 15s de apiGet.
const TIMEOUT_GERAR_MS = 45_000;

/**
 * Pede ao backend pra gerar o instalador do Orion Agent já configurado com
 * a agent_key da empresa (ver handler/installer_handlers.go) e dispara o
 * download no navegador a partir da signed URL devolvida.
 *
 * O binário (~16MB) não vem no corpo da resposta da API — estouraria o
 * limite de payload das Serverless Functions da Vercel (4.5MB). O backend
 * sobe pro Supabase Storage e devolve só a URL assinada; o download real
 * acontece direto de lá.
 */
export async function baixarInstaladorDoAgente(companyId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetchWithTimeout(`${API_URL}/api/monitoring/companies/${companyId}/installer`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeoutMs: TIMEOUT_GERAR_MS,
  });

  const text = await res.text().catch(() => '');
  let json: { url?: string; filename?: string; error?: string } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // corpo não era JSON — trata como erro genérico abaixo
  }

  if (!res.ok || !json.url) {
    throw new Error(json.error || text || res.statusText || 'Erro ao gerar instalador');
  }

  const a = document.createElement('a');
  a.href = json.url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
