import { supabase } from '@/integrations/supabase/client';

type InvokeResult<T> = {
  data: T | null;
  error: { message: string; context?: unknown } | null;
};

/**
 * Chama uma Edge Function do Supabase. As funções de usuário (criar, editar,
 * excluir e mesclar usuário, senha provisória, alerta de senha, rate limit)
 * existem só como Edge desde 23/09/2026 (ORN-DUP-02): as rotas Go que as
 * espelhavam foram removidas, e toda correção era feita duas vezes.
 */
export async function invokeOrionFunction<T>(
  name: string,
  body?: unknown
): Promise<InvokeResult<T>> {
  const res = await supabase.functions.invoke(name, { body });
  if (res.error) {
    let message = res.error.message;
    if (res.error.context && typeof (res.error.context as { json?: unknown }).json === 'function') {
      try {
        const errBody = await (res.error.context as Response).clone().json();
        if (errBody?.error) {
          message = typeof errBody.error === 'string' ? errBody.error : JSON.stringify(errBody.error);
        } else if (errBody?.message) {
          message = typeof errBody.message === 'string' ? errBody.message : JSON.stringify(errBody.message);
        }
      } catch {
        // mantém a mensagem padrão
      }
    }
    return { data: null, error: { message, context: res.error.context } };
  }
  return { data: res.data as T, error: null };
}
