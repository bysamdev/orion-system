import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

// Montar o instalador (assinar chave, subir pro Storage) é mais lento que
// as chamadas JSON de sempre, por isso um timeout próprio em vez do padrão
// de 15s de apiGet.
const TIMEOUT_GERAR_MS = 45_000;

interface RespostaInstalador {
  url?: string;
  filename?: string;
  command?: string;
  error?: string;
}

/**
 * Chama um endpoint de geração de instalador e devolve o JSON já validado.
 * Compartilhado pelo .exe e pelo .msi — os dois seguem o mesmo formato de
 * resposta (ver handler/installer_handlers.go): o binário não vem no corpo
 * da resposta (estouraria o limite de payload de 4.5MB das Serverless
 * Functions da Vercel), só uma signed URL do Supabase Storage.
 */
async function pedirInstalador(caminho: string): Promise<RespostaInstalador> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetchWithTimeout(`${API_URL}${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeoutMs: TIMEOUT_GERAR_MS,
  });

  const text = await res.text().catch(() => '');
  let json: RespostaInstalador = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // corpo não era JSON — trata como erro genérico abaixo
  }

  if (!res.ok || !json.url) {
    throw new Error(json.error || text || res.statusText || 'Erro ao gerar instalador');
  }
  return json;
}

function dispararDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Pede ao backend pra gerar o instalador .exe do Orion Agent já configurado
 * com a agent_key da empresa e dispara o download no navegador.
 */
export async function baixarInstaladorDoAgente(companyId: string): Promise<void> {
  const json = await pedirInstalador(`/api/monitoring/companies/${companyId}/installer`);
  dispararDownload(json.url!);
}

/**
 * Pede ao backend o .msi genérico do Orion Agent (mesmo build pra qualquer
 * empresa — a personalização vai via propriedades do msiexec, não dentro
 * do arquivo, o jeito padrão de GPO/SCCM/Intune parametrizarem por
 * grupo/OU) e dispara o download. Devolve o comando msiexec pronto, já com
 * a agent_key desta empresa preenchida, pra copiar num Script de
 * Inicialização do GPO.
 */
export async function baixarInstaladorMsi(companyId: string): Promise<string> {
  const json = await pedirInstalador(`/api/monitoring/companies/${companyId}/installer-msi`);
  dispararDownload(json.url!);
  return json.command ?? '';
}
