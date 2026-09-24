// Regras de permissão das Edge que criam e alteram usuários
// (create-user-credentials, admin-update-user) e da troca de senha provisória.
// Sem Deno nem rede, para serem testadas com vitest. As Edge usam service_role,
// que ignora a RLS: estas regras são a única barreira, por isso têm teste.

export type Papel = 'customer' | 'technician' | 'admin' | 'developer' | string;

export interface ErroDeRegra {
  status: 400 | 403;
  error: string;
}

// Só admin e developer criam ou alteram usuários.
export function podeGerirUsuarios(papeis: Papel[]): boolean {
  return papeis.some((p) => p === 'admin' || p === 'developer');
}

// Só developer concede developer, em qualquer empresa (ORN-SEC-03).
export function podeConcederPapel(papeisDoChamador: Papel[], papelNovo: Papel | undefined): boolean {
  return papelNovo !== 'developer' || papeisDoChamador.includes('developer');
}

export interface DadosDaAtualizacao {
  chamadorId: string;
  papeisDoChamador: Papel[];
  // Usuário da empresa mãe age em qualquer empresa (is_master_company_user).
  escopoGlobal: boolean;
  empresaDoChamador: string | null;
  empresaDoAlvo: string | null;
  alvoId: string;
  papelNovo?: Papel;
  empresaNova?: string;
  senhaNova?: unknown;
  statusNovo?: unknown;
}

// Todas as checagens de admin-update-user que não dependem de gravar nada.
// Devolve o primeiro erro, ou null quando a atualização pode seguir.
export function validarAtualizacaoDeUsuario(d: DadosDaAtualizacao): ErroDeRegra | null {
  if (!d.alvoId) return { status: 400, error: 'user_id é obrigatório' };

  if (d.papelNovo && d.alvoId === d.chamadorId) {
    return { status: 400, error: 'Proibido: Você não pode alterar sua própria função (role)' };
  }

  if (!d.escopoGlobal) {
    if (!d.empresaDoChamador || !d.empresaDoAlvo || d.empresaDoAlvo !== d.empresaDoChamador) {
      return { status: 403, error: 'Usuário não pertence à sua empresa' };
    }
    if (d.empresaNova && d.empresaNova !== d.empresaDoChamador) {
      return { status: 403, error: 'Não é permitido mover o usuário para outra empresa' };
    }
  }

  if (!podeConcederPapel(d.papeisDoChamador, d.papelNovo)) {
    return { status: 403, error: 'Só developer pode conceder a função developer' };
  }

  if (typeof d.senhaNova === 'string' && d.senhaNova.trim().length > 0 && d.senhaNova.trim().length < 6) {
    return { status: 400, error: 'A senha deve ter no mínimo 6 caracteres' };
  }

  if (d.statusNovo) {
    if (d.statusNovo !== 'active' && d.statusNovo !== 'inactive') {
      return { status: 400, error: 'Status inválido' };
    }
    if (d.statusNovo === 'inactive' && d.alvoId === d.chamadorId) {
      return { status: 400, error: 'Você não pode inativar a própria conta' };
    }
  }

  return null;
}

export interface DadosDaCriacao {
  papeisDoChamador: Papel[];
  escopoGlobal: boolean;
  empresaDoChamador: string | null;
  empresaNova: string;
  papelNovo: Papel;
}

// Checagens de create-user-credentials depois de conferir os campos obrigatórios.
export function validarCriacaoDeUsuario(d: DadosDaCriacao): ErroDeRegra | null {
  if (!d.escopoGlobal && (!d.empresaDoChamador || d.empresaDoChamador !== d.empresaNova)) {
    return { status: 403, error: 'Não é permitido criar usuários em outra empresa' };
  }
  if (!podeConcederPapel(d.papeisDoChamador, d.papelNovo)) {
    return { status: 403, error: 'Só developer pode conceder a função developer' };
  }
  return null;
}

// Senha que a pessoa cria para si na troca obrigatória: mais que os 6 aceitos
// na senha temporária do gestor, porque esta é a que fica.
export const SENHA_MINIMA = 8;

export function validarNovaSenha(senha: unknown): string | null {
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }
  if (senha.trim() !== senha) return 'A senha não pode começar nem terminar com espaço.';
  return null;
}

// Senha provisória forte. crypto.getRandomValues é CSPRNG; o laço de rejeição
// descarta bytes fora de um múltiplo exato do alfabeto para não enviesar os
// primeiros caracteres (o formato antigo, "Orion" + 4 dígitos, dava 9.000
// valores — Strix vuln-0006).
export const ALFABETO_SENHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

export function gerarSenhaProvisoria(tamanho = 16): string {
  const limite = 256 - (256 % ALFABETO_SENHA.length);
  let senha = '';
  while (senha.length < tamanho) {
    const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
    for (const b of bytes) {
      if (b >= limite) continue;
      senha += ALFABETO_SENHA[b % ALFABETO_SENHA.length];
      if (senha.length === tamanho) break;
    }
  }
  return senha;
}
