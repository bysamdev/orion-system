// Web Push no navegador: registro do service worker, inscrição e cancelamento.
// A inscrição (endpoint + chaves) é guardada em push_inscricoes; a Edge
// enviar-push usa esses dados para mandar os avisos.

import { supabase } from '@/integrations/supabase/client';

export type EstadoPush = 'sem-suporte' | 'nao-configurado' | 'bloqueado' | 'desligado' | 'ligado';

const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushSuportado(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// A chave VAPID vem em base64url; o PushManager exige os bytes crus.
export function base64UrlParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(texto.length));
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration('/');
  return existente ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function estadoAtual(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  if (!CHAVE_PUBLICA) return 'nao-configurado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

// Pede permissão (precisa vir de um clique do usuário), inscreve o navegador
// e grava a inscrição. Devolve o estado final.
export async function ligarPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  if (!CHAVE_PUBLICA) return 'nao-configurado';

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado';

  const reg = await registro();
  await navigator.serviceWorker.ready;
  const inscricao = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(CHAVE_PUBLICA),
    });

  const json = inscricao.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Inscrição de push incompleta');
  }

  // A função grava em nome de quem está logado e assume o endpoint se outra
  // conta já tinha inscrito este navegador.
  const { error } = await supabase.rpc('registrar_inscricao_push', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;

  return 'ligado';
}

export async function desligarPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) {
    await supabase.from('push_inscricoes').delete().eq('endpoint', inscricao.endpoint);
    await inscricao.unsubscribe();
  }
  return 'desligado';
}
