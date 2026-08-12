import { supabase } from '@/integrations/supabase/client';
import { fetchWithTimeout } from '@/lib/fetch-client';

type InvokeResult<T> = {
  data: T | null;
  error: { message: string; context?: any } | null;
};

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';


type ErrorLikeBody = { error?: unknown; message?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getErrorMessage(v: unknown): string | undefined {
  if (!isRecord(v)) return undefined;
  const maybe = (v as ErrorLikeBody).error ?? (v as ErrorLikeBody).message;
  return typeof maybe === 'string' ? maybe : undefined;
}

async function safeJson(text: string): Promise<unknown> {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function invokeOrionFunction<T>(
  name: string,
  body?: unknown
): Promise<InvokeResult<T>> {
  // fallback: mantém o sistema funcionando mesmo sem a API Go configurada
  if (!API_URL) {
    const res = await supabase.functions.invoke(name, { body });
    if (res.error) {
      let message = res.error.message;
      if (res.error.context && typeof (res.error.context as any).json === 'function') {
        try {
          const errBody = await (res.error.context as Response).clone().json();
          if (errBody?.error) {
            message = typeof errBody.error === 'string' ? errBody.error : JSON.stringify(errBody.error);
          } else if (errBody?.message) {
            message = typeof errBody.message === 'string' ? errBody.message : JSON.stringify(errBody.message);
          }
        } catch {
          // fallback to default message
        }
      }
      return { data: null, error: { message, context: res.error.context } };
    }
    return { data: res.data as T, error: null };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetchWithTimeout(`${API_URL}/functions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      timeoutMs: 15000,
    });

    const text = await res.text();
    const json = await safeJson(text);

    if (!res.ok) {
      return { data: null, error: { message: getErrorMessage(json) || res.statusText } };
    }

    return { data: (json as T) ?? null, error: null };
  } catch (e: unknown) {
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : 'Erro ao chamar backend' },
    };
  }
}

