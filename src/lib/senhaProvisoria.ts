import type { User } from '@supabase/supabase-js';

// Espelho de lib.DeveTrocarSenha (lib/supabase.go): o backend liga esta
// marca em app_metadata quando a conta nasce com senha provisória ou quando o
// gestor define uma senha temporária, e desliga quando a pessoa cria a dela.
export function deveTrocarSenha(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.deve_trocar_senha === true;
}

// Mesma regra do backend (problemaNaSenhaNova, handler/senha_provisoria.go),
// mais a conferência da confirmação, que só existe na tela.
export function problemaNaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (senha.trim() !== senha) return 'A senha não pode começar nem terminar com espaço.';
  if (senha !== confirmacao) return 'As duas senhas não são iguais.';
  return null;
}
