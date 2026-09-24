// Dispositivos conectados: regras puras (testadas em __tests__/sessoes.test.ts).
// Os dados vêm de minhas_sessoes() no banco.

export const LIMITE_DE_DISPOSITIVOS = 2;

export interface SessaoDoUsuario {
  id: string;
  criada_em: string;
  ultimo_uso: string;
  ip: string | null;
  user_agent: string | null;
  atual: boolean;
}

// session_id do token de acesso do Supabase (sem validar assinatura: é só para
// saber qual sessão encerrar depois de um novo login no mesmo aparelho).
export function sessaoDoToken(accessToken: string | null | undefined): string | null {
  try {
    const carga = accessToken?.split('.')[1];
    if (!carga) return null;
    const base64 = carga.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
    return typeof json.session_id === 'string' ? json.session_id : null;
  } catch {
    return null;
  }
}

// Quantos acessos a pessoa precisa encerrar para voltar ao limite.
export function acessosAcimaDoLimite(sessoes: SessaoDoUsuario[]): number {
  return Math.max(0, sessoes.length - LIMITE_DE_DISPOSITIVOS);
}

// "Chrome no Windows", "Safari no iPhone"... a partir do user agent.
export function descreverDispositivo(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  if (!ua) return 'Dispositivo desconhecido';

  const sistema =
    /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux'
    : null;

  // A ordem importa: Edge e Opera também dizem "Chrome"; Chrome também diz "Safari".
  const navegador =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /Chrome|CriOS/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : null;

  if (navegador && sistema) return `${navegador} no ${sistema}`;
  return navegador ?? sistema ?? 'Dispositivo desconhecido';
}
