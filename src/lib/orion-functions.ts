import { supabase } from '@/integrations/supabase/client';

type InvokeResult<T> = {
  data: T | null;
  error: { message: string } | null;
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
    return (await supabase.functions.invoke(name, { body })) as InvokeResult<T>;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(`${API_URL}/functions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
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

