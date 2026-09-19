import { describe, expect, it } from 'vitest';
import { deveTrocarSenha, problemaNaSenha } from './senhaProvisoria';

describe('senha provisória', () => {
  it('só obriga a troca quando o backend ligou a marca', () => {
    expect(deveTrocarSenha({ app_metadata: { deve_trocar_senha: true } })).toBe(true);
    expect(deveTrocarSenha({ app_metadata: { deve_trocar_senha: false } })).toBe(false);
    expect(deveTrocarSenha({ app_metadata: {} })).toBe(false);
    expect(deveTrocarSenha(null)).toBe(false);
  });

  it('valida a senha nova com a mesma regra do backend', () => {
    expect(problemaNaSenha('curta', 'curta')).toMatch(/8 caracteres/);
    expect(problemaNaSenha(' comespaco1', ' comespaco1')).toMatch(/espaço/);
    expect(problemaNaSenha('senhaboa1', 'senhaboa2')).toMatch(/iguais/);
    expect(problemaNaSenha('senhaboa1', 'senhaboa1')).toBeNull();
  });
});
